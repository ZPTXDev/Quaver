import {
    type InteractionCallbackResponse,
    type InteractionEditReplyOptions,
    type InteractionReplyOptions,
    type InteractionResponse,
    type InteractionUpdateOptions,
    type Message,
    MessageFlags,
    PermissionsBitField,
} from 'discord.js';
import type { AdditionalBuilderOptions, NonSpecialInteractions } from '.';
import { logger, MessageOptionsBuilderType } from './util/common';
import type { MessageOptionsBuilderInputs, MessageOptionsBuilderOptions } from './util/common.d';
import { buildMessageOptions } from './util/util';

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

    /**
     * Replies with a message.
     * @param inputData - The data to be used. Can be a string, ContainerBuilder, or an array of either.
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
    ): Promise<InteractionCallbackResponse | Message>;
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
        replyMsgOpts.flags = [MessageFlags.IsComponentsV2];
        replyMsgOpts.allowedMentions = { parse: [] };
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
                replyMsgOpts.flags = [
                    MessageFlags.IsComponentsV2,
                    MessageFlags.Ephemeral,
                ];
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
}

export enum ForceType {
    Reply,
    Edit,
    Update,
}
