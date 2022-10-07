import { PermissionsBitField } from 'discord.js';
import { logger } from '#lib/util/common.js';
import { getGuildLocaleString, buildMessageOptions } from '#lib/util/util.js';

/** Class for handling replies to interactions. */
export default class ReplyHandler {
	/**
	 * Create an instance of ReplyHandler.
	 * @param {import('discord.js').ChatInputCommandInteraction} interaction The discord.js ChatInputCommandInteraction object.
	 */
	constructor(interaction) {
		this.interaction = interaction;
	}

	/**
	 * Replies with a message.
	 * @param {string|EmbedBuilder|string[]|EmbedBuilder[]} msgData The data to be used. Can be a string, EmbedBuilder, or an array of either.
	 * @param {{type?: "success"|"neutral"|"warning"|"error", components?: import('discord.js').ActionRowBuilder[], files?: import('discord.js').Attachment[], ephemeral?: boolean, fetchReply?: boolean, force?: "reply"|"edit"|"update"}} optionals Extra data, such as type or components.
	 * @returns {Promise<import('discord.js').InteractionResponse|import('discord.js').Message|boolean>} The message that was sent.
	 */
	async reply(msgData, { type = 'neutral', components = null, files = null, ephemeral = false, fetchReply = false, force = null } = {}) {
		/** @type {import('discord.js').MessageOptions & {embeds: [EmbedBuilder & {data: import('discord.js').APIEmbed}]}} */
		const replyData = buildMessageOptions(msgData, { type, components, files });
		replyData.fetchReply = fetchReply;
		if (force === 'reply' || !this.interaction.replied && !this.interaction.deferred && !force) {
			if (type === 'error' || ephemeral || this.interaction.channel && !this.interaction.channel.permissionsFor(this.interaction.client.user.id).has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]))) {
				replyData.ephemeral = true;
			}
			try {
				return await this.interaction.reply(replyData);
			}
			catch (err) {
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				return false;
			}
		}
		if (force === 'update') {
			try {
				return await this.interaction.update(replyData);
			}
			catch (err) {
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				return false;
			}
		}
		try {
			return await this.interaction.editReply(replyData);
		}
		catch (err) {
			logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
			return false;
		}
	}

	/**
	 * Replies with a localized message.
	 * @param {string} code The code of the locale string to be used.
	 * @param {{type?: "success"|"neutral"|"warning"|"error", args?: string[], components?: import('discord.js').ActionRowBuilder[], files?: import('discord.js').Attachment[], ephemeral?: boolean, fetchReply?: boolean, force?: "reply"|"edit"|"update"}} optionals Extra data, such as type or components.
	 * @returns {Promise<import('discord.js').InteractionResponse|import('discord.js').Message|boolean>} The message that was sent.
	 */
	async locale(stringPath, { args = [], type = 'neutral', components = null, files = null, ephemeral = false, force = null } = {}) {
		return this.reply(await getGuildLocaleString(this.interaction.guildId, stringPath, ...args), { type, components, files, ephemeral, force });
	}
}
