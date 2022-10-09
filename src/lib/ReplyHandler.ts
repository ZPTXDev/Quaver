import { logger } from '#src/lib/util/common.js';
import { buildMessageOptions, getGuildLocaleString } from '#src/lib/util/util.js';
import type { ActionRowBuilder, AttachmentBuilder, AutocompleteInteraction, EmbedBuilder, Interaction, InteractionResponse, Message, MessageActionRowComponentBuilder } from 'discord.js';
import { PermissionsBitField } from 'discord.js';

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
	async reply(inputData: string | EmbedBuilder | (string | EmbedBuilder)[], { type = 'neutral', components = null, files = null, ephemeral = false, fetchReply = false, force = null }: { type?: 'success' | 'neutral' | 'warning' | 'error'; components?: ActionRowBuilder<MessageActionRowComponentBuilder>[]; files?: AttachmentBuilder[]; ephemeral?: boolean; fetchReply?: boolean; force?: 'reply' | 'edit' | 'update'; } = {}): Promise<InteractionResponse | Message | boolean> {
		const replyMsgOpts = buildMessageOptions(inputData, { type, components, files });
		replyMsgOpts.fetchReply = fetchReply;
		if (force === 'reply' || !this.interaction.replied && !this.interaction.deferred && !force) {
			if (type === 'error' || ephemeral || this.interaction.channel && !this.interaction.channel.permissionsFor(this.interaction.client.user.id).has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]))) {
				replyMsgOpts.ephemeral = true;
			}
			try {
				return await this.interaction.reply(replyMsgOpts);
			}
			catch (err) {
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				return false;
			}
		}
		if (force === 'update' && !this.interaction.isCommand() && (!this.interaction.isModalSubmit() || this.interaction.isFromMessage())) {
			try {
				return await this.interaction.update(replyMsgOpts);
			}
			catch (err) {
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				return false;
			}
		}
		try {
			return await this.interaction.editReply(replyMsgOpts);
		}
		catch (err) {
			logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
			return false;
		}
	}

	/**
	 * Replies with a localized message.
	 * @param stringPath - The code of the locale string to be used.
	 * @param options - Extra data, such as type or components.
	 * @returns The message that was sent.
	 */
	async locale(stringPath: string, { vars = [], type = 'neutral', components = null, files = null, ephemeral = false, force = null }: { vars?: string[]; type?: 'success' | 'neutral' | 'warning' | 'error'; components?: ActionRowBuilder<MessageActionRowComponentBuilder>[]; files?: AttachmentBuilder[]; ephemeral?: boolean; fetchReply?: boolean; force?: 'reply' | 'edit' | 'update'; } = {}): Promise<InteractionResponse | Message | boolean> {
		const guildLocaleString = await getGuildLocaleString(this.interaction.guildId, stringPath, ...vars);
		return this.reply(guildLocaleString, { type, components, files, ephemeral, force });
	}
}
