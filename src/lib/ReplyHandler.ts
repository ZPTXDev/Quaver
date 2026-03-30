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
        return !!(
            this.interaction.channel &&
            !this.interaction.channel
                .permissionsFor(this.interaction.client.user.id)
                .has(
                    new PermissionsBitField([
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                    ]),
                )
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
    ): Promise<InteractionResponse>;
    async reply(
        inputData: MessageOptionsBuilderInputs,
        options?: MessageOptionsBuilderOptions &
            AdditionalBuilderOptions & { withResponse: true },
    ): Promise<InteractionCallbackResponse | Message>;
    async reply(
        inputData: MessageOptionsBuilderInputs,
        options?: MessageOptionsBuilderOptions & AdditionalBuilderOptions,
    ): Promise<InteractionResponse>;
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
        replyMsgOpts.flags = BASE_FLAGS;
        replyMsgOpts.allowedMentions = { parse: [] };

        const isInitialReply =
            force === ForceType.Reply ||
            (!force && !this.interaction.replied && !this.interaction.deferred);

        if (isInitialReply) {
            const isEphemeral =
                ephemeral ||
                type === MessageOptionsBuilderType.Error ||
                this.lacksChannelPermissions();
            if (isEphemeral) replyMsgOpts.flags = EPHEMERAL_FLAGS;
            return this.tryAction(
                (): Promise<InteractionResponse<true>> =>
                    this.interaction.reply(replyMsgOpts),
            );
        }

        if (
            force === ForceType.Update &&
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
            if (ephemeral) replyMsgOpts.flags = EPHEMERAL_FLAGS;
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
