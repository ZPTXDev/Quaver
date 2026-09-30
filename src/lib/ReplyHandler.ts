import {
    type ActionRowBuilder,
    type AttachmentBuilder,
    type ContainerBuilder,
    type FileBuilder,
    type InteractionCallbackResponse,
    type InteractionEditReplyOptions,
    type InteractionReplyOptions,
    type InteractionResponse,
    type InteractionUpdateOptions,
    type MediaGalleryBuilder,
    type Message,
    type MessageActionRowComponentBuilder,
    MessageFlags,
    PermissionsBitField,
    type SectionBuilder,
    type SeparatorBuilder,
    type TextDisplayBuilder,
} from 'discord.js';
import type { NonSpecialInteractions } from './interactions';
import { logger } from './logger';
import { buildMessageOptions } from './util';
import { QuaverGuild } from './guild';

type AdditionalBuilderOptions = {
    ephemeral?: boolean;
    force?: ForceType;
    withResponse?: boolean;
};

export type TopLevelComponentBuilders =
    | ActionRowBuilder<MessageActionRowComponentBuilder>
    | SectionBuilder
    | TextDisplayBuilder
    | MediaGalleryBuilder
    | FileBuilder
    | SeparatorBuilder
    | ContainerBuilder;

export type MessageOptionsBuilderInputs =
    | string
    | TopLevelComponentBuilders
    | Array<string | TopLevelComponentBuilders>;

export type MessageOptionsBuilderOptions = {
    type?: MessageOptionsBuilderType;
    components?: Array<TopLevelComponentBuilders>;
    files?: AttachmentBuilder[];
};

export enum MessageOptionsBuilderType {
    Success,
    Neutral,
    Warning,
    Error,
}

export enum ForceType {
    Reply,
    Edit,
    Update,
    FollowUp,
}

const BASE_FLAGS = [MessageFlags.IsComponentsV2] as const;
const EPHEMERAL_FLAGS = [
    MessageFlags.IsComponentsV2,
    MessageFlags.Ephemeral,
] as const;
const SILENT_FLAGS = [
    MessageFlags.IsComponentsV2,
    MessageFlags.SuppressNotifications,
] as const;

/** Class for handling replies to interactions. */
export class ReplyHandler {
    interaction: NonSpecialInteractions;

    /**
     * Create an instance of ReplyHandler.
     * @param interaction - The discord.js ChatInputCommandInteraction object.
     */
    constructor(interaction: NonSpecialInteractions) {
        this.interaction = interaction;
    }

    private async tryAction<T>(
        action: () => Promise<T>,
    ): Promise<T | undefined> {
        try {
            return await action();
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`${error.message}\n${error.stack}`);
            }
            return undefined;
        }
    }

    private lacksChannelPermissions(): boolean {
        const channel = this.interaction.channel;
        const permissions = this.interaction.appPermissions;
        if (!permissions) return !!channel;
        return !permissions.has(
            new PermissionsBitField([
                PermissionsBitField.Flags.ViewChannel,
                channel.isThread()
                    ? PermissionsBitField.Flags.SendMessagesInThreads
                    : PermissionsBitField.Flags.SendMessages,
            ]),
        );
    }

    /**
     * Defers the reply to the interaction.
     * @param options - Optional defer options (ephemeral flag).
     * @returns The interaction response.
     */
    async deferReply(options?: {
        ephemeral?: boolean;
    }): Promise<InteractionResponse | undefined> {
        const ephemeral = options?.ephemeral ?? false;
        const deferOptions: { flags?: MessageFlags[] } = {};

        if (ephemeral) {
            deferOptions.flags = EPHEMERAL_FLAGS as MessageFlags[];
        } else {
            // Apply silent messages flag for non-ephemeral defers
            const guild = this.interaction.guild;
            if (guild) {
                const wrappedGuild = await QuaverGuild.wrap(guild);
                const silentMessages =
                    (await wrappedGuild.settings.get<boolean>('silentmessages')) ?? true;
                if (silentMessages) {
                    deferOptions.flags = SILENT_FLAGS as MessageFlags[];
                }
            }
        }

        return this.tryAction(
            (): Promise<InteractionResponse<true>> =>
                this.interaction.deferReply(deferOptions),
        );
    }

    /**
     * Replies with a message.
     * @param inputData - The data to be used. Can be a string, ContainerBuilder, or an array of either.
     * @param options - Extra data, such as type or components.
     * @returns The message that was sent.
     */
    async reply(
        inputData: MessageOptionsBuilderInputs,
        options?: MessageOptionsBuilderOptions &
            AdditionalBuilderOptions & { withResponse?: false },
    ): Promise<InteractionResponse | Message | undefined>;
    async reply(
        inputData: MessageOptionsBuilderInputs,
        options: MessageOptionsBuilderOptions &
            AdditionalBuilderOptions & { withResponse: true },
    ): Promise<InteractionCallbackResponse | Message | undefined>;
    async reply(
        inputData: MessageOptionsBuilderInputs,
        {
            type = MessageOptionsBuilderType.Neutral,
            components = null,
            files = null,
            ephemeral = false,
            force = null,
            withResponse = false,
        }: MessageOptionsBuilderOptions & AdditionalBuilderOptions = {},
    ): Promise<
        InteractionResponse | InteractionCallbackResponse | Message | undefined
    > {
        const replyMsgOpts = buildMessageOptions(inputData, {
            type,
            components,
            files,
        }) as InteractionReplyOptions;
        replyMsgOpts.withResponse = withResponse;
        replyMsgOpts.allowedMentions = { parse: [] };

        const isInitialReply =
            force === ForceType.Reply ||
            (!force && !this.interaction.replied && !this.interaction.deferred);

        if (isInitialReply) {
            const isEphemeral =
                ephemeral ||
                type === MessageOptionsBuilderType.Error ||
                this.lacksChannelPermissions();
            if (isEphemeral) {
                replyMsgOpts.flags = EPHEMERAL_FLAGS;
            } else {
                // Apply silent messages flag for non-ephemeral messages
                const guild = this.interaction.guild;
                if (guild) {
                    const wrappedGuild = await QuaverGuild.wrap(guild);
                    const silentMessages =
                        (await wrappedGuild.settings.get<boolean>('silentmessages')) ?? true;
                    if (silentMessages) {
                        replyMsgOpts.flags = SILENT_FLAGS;
                    } else {
                        replyMsgOpts.flags = BASE_FLAGS;
                    }
                } else {
                    replyMsgOpts.flags = BASE_FLAGS;
                }
            }
            return this.tryAction(
                (): Promise<InteractionResponse<true>> =>
                    this.interaction.reply(replyMsgOpts),
            );
        }

        if (
            force === ForceType.Update &&
            !this.interaction.replied &&
            !this.interaction.deferred &&
            !this.interaction.isCommand() &&
            (!this.interaction.isModalSubmit() ||
                this.interaction.isFromMessage())
        ) {
            return this.tryAction(
                (): Promise<InteractionResponse<true>> =>
                    (
                        this.interaction as Extract<
                            NonSpecialInteractions,
                            { update: unknown }
                        >
                    ).update(replyMsgOpts as InteractionUpdateOptions),
            );
        }

        if (force === ForceType.FollowUp) {
            if (ephemeral || type === MessageOptionsBuilderType.Error) {
                replyMsgOpts.flags = EPHEMERAL_FLAGS;
            } else {
                // Apply silent messages flag for non-ephemeral follow-ups
                const guild = this.interaction.guild;
                if (guild) {
                    const wrappedGuild = await QuaverGuild.wrap(guild);
                    const silentMessages =
                        (await wrappedGuild.settings.get<boolean>('silentmessages')) ?? true;
                    if (silentMessages) {
                        replyMsgOpts.flags = SILENT_FLAGS;
                    } else {
                        replyMsgOpts.flags = BASE_FLAGS;
                    }
                } else {
                    replyMsgOpts.flags = BASE_FLAGS;
                }
            }
            return this.tryAction(
                (): Promise<Message<true>> =>
                    this.interaction.followUp(replyMsgOpts),
            );
        }

        return this.tryAction(
            (): Promise<Message<true>> =>
                this.interaction.editReply(
                    replyMsgOpts as InteractionEditReplyOptions,
                ),
        );
    }
}
