import type { MessageOptionsBuilderInputs, MessageOptionsBuilderOptions } from '#src/lib/util/common.d.js';
import { logger, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { buildMessageOptions, getGuildLocaleString } from '#src/lib/util/util.js';
import type {
    AutocompleteInteraction,
    Interaction,
    InteractionCallbackResponse,
    InteractionEditReplyOptions,
    InteractionReplyOptions,
    InteractionResponse,
    InteractionUpdateOptions,
    Message,
} from 'discord.js';
import { PermissionsBitField } from 'discord.js';
import type { AdditionalBuilderOptions } from './ReplyHandler.d.js';

/** Class for handling replies to interactions. */
export default class ReplyHandler {
    interaction: Exclude<Interaction, AutocompleteInteraction>;

    /**
     * Create an instance of ReplyHandler.
     * @param interaction - The discord.js ChatInputCommandInteraction object.
     */
    constructor(interaction: Exclude<Interaction, AutocompleteInteraction>) {
        this.interaction = interaction;
    }

    /**
     * Replies with a message.
     * @param inputData - The data to be used. Can be a string, EmbedBuilder, or an array of either.
     * @param options - Extra data, such as type or components.
     * @returns The message that was sent.
     */
    async reply(
        inputData: MessageOptionsBuilderInputs,
        {
            type,
            components,
            files,
            ephemeral,
            force,
            withResponse,
        }?: MessageOptionsBuilderOptions &
            AdditionalBuilderOptions & { withResponse?: false },
    ): Promise<InteractionResponse>;
    async reply(
        inputData: MessageOptionsBuilderInputs,
        {
            type,
            components,
            files,
            ephemeral,
            force,
            withResponse,
        }?: MessageOptionsBuilderOptions &
            AdditionalBuilderOptions & { withResponse: true },
    ): Promise<InteractionCallbackResponse>;
    async reply(
        inputData: MessageOptionsBuilderInputs,
        {
            type,
            components,
            files,
            ephemeral,
            force,
            withResponse,
        }?: MessageOptionsBuilderOptions & AdditionalBuilderOptions,
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
        if (
            force === ForceType.Reply ||
            (!this.interaction.replied && !this.interaction.deferred && !force)
        ) {
            if (
                type === MessageOptionsBuilderType.Error ||
                ephemeral ||
                (this.interaction.channel &&
                    !this.interaction.channel
                        .permissionsFor(this.interaction.client.user.id)
                        .has(
                            new PermissionsBitField([
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                            ]),
                        ))
            ) {
                replyMsgOpts.ephemeral = true;
            }
            try {
                return await this.interaction.reply(replyMsgOpts);
            } catch (error) {
                if (error instanceof Error) {
                    logger.error({
                        message: `${error.message}\n${error.stack}`,
                        label: 'Quaver',
                    });
                }
                return undefined;
            }
        }
        if (
            force === ForceType.Update &&
            !this.interaction.isCommand() &&
            (!this.interaction.isModalSubmit() ||
                this.interaction.isFromMessage())
        ) {
            try {
                return await this.interaction.update(
                    replyMsgOpts as InteractionUpdateOptions,
                );
            } catch (error) {
                if (error instanceof Error) {
                    logger.error({
                        message: `${error.message}\n${error.stack}`,
                        label: 'Quaver',
                    });
                }
                return undefined;
            }
        }
        try {
            return await this.interaction.editReply(
                replyMsgOpts as InteractionEditReplyOptions,
            );
        } catch (error) {
            if (error instanceof Error) {
                logger.error({
                    message: `${error.message}\n${error.stack}`,
                    label: 'Quaver',
                });
            }
            return undefined;
        }
    }

    /**
     * Replies with a localized message.
     * @param stringPath - The code of the locale string to be used.
     * @param options - Extra data, such as type or components.
     * @returns The message that was sent.
     */
    async locale(
        stringPath: string,
        {
            vars,
            type,
            components,
            files,
            ephemeral,
            force,
            withResponse,
        }?: MessageOptionsBuilderOptions &
            AdditionalBuilderOptions & {
                vars?: string[];
                withResponse?: false;
            },
    ): Promise<InteractionResponse>;
    async locale(
        stringPath: string,
        {
            vars,
            type,
            components,
            files,
            ephemeral,
            force,
            withResponse,
        }?: MessageOptionsBuilderOptions &
            AdditionalBuilderOptions & { vars?: string[]; withResponse: true },
    ): Promise<Message>;
    async locale(
        stringPath: string,
        {
            vars,
            type,
            components,
            files,
            ephemeral,
            force,
            withResponse,
        }?: MessageOptionsBuilderOptions &
            AdditionalBuilderOptions & { vars?: string[] },
    ): Promise<InteractionResponse>;
    async locale(
        stringPath: string,
        {
            vars = [],
            type = MessageOptionsBuilderType.Neutral,
            components = null,
            files = null,
            ephemeral = false,
            force = null,
            withResponse = false,
        }: MessageOptionsBuilderOptions &
            AdditionalBuilderOptions & { vars?: string[] } = {},
    ): Promise<InteractionResponse | Message | undefined> {
        const guildLocaleString = await getGuildLocaleString(
            this.interaction.guildId,
            stringPath,
            ...vars,
        );
        return this.reply(guildLocaleString, {
            type,
            components,
            files,
            ephemeral,
            force,
            withResponse,
        });
    }
}

export enum ForceType {
    Reply,
    Edit,
    Update,
}
