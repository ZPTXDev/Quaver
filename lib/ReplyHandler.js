import { EmbedBuilder, PermissionsBitField } from 'discord.js';
import { defaultLocale, colors } from '#settings';
import { data, logger } from '#lib/util/common.js';
import { getLocale } from '#lib/util/util.js';

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
	 * Returns a replyData object.
	 * @private
	 * @param {string} msg The message to be used.
	 * @param {import('discord.js').APIEmbed & {additionalEmbeds?: EmbedBuilder, components?: import('discord.js').MessageOptions}} embedExtras Extra data to be passed to the embed.
	 * @param {"success"|"neutral"|"warning"|"error"} [type=neutral] Type of the message.
	 * @returns {import('discord.js').MessageOptions & {embeds: [EmbedBuilder]}} The replyData object.
	 */
	replyDataConstructor(msg, embedExtras, type = 'neutral') {
		/** @type {import('discord.js').MessageOptions & {embeds: [EmbedBuilder]}} */
		const replyData = {
			embeds: [
				new EmbedBuilder()
					.setTitle(embedExtras?.title ?? null)
					.setDescription(msg)
					.setFooter({ text: embedExtras?.footer ?? null })
					.setThumbnail(embedExtras?.thumbnail ?? null)
					.setColor(colors[type] ?? colors.neutral),
				...embedExtras?.additionalEmbeds ?? [],
			],
		};
		if (embedExtras?.components) replyData.components = embedExtras.components;
		return replyData;
	}

	/**
	 * Replies with a message.
	 * @param {string} msg The message to be used.
	 * @param {import('discord.js').APIEmbed & {additionalEmbeds?: EmbedBuilder, components?: import('discord.js').MessageOptions}} embedExtras Extra data to be passed to the embed.
	 * @param {"success"|"neutral"|"warning"|"error"} [type=neutral] Type of the message.
	 * @returns {Promise<import('discord.js').Message|boolean>} The message that was sent.
	 */
	async reply(msg, embedExtras, type) {
		/** @type {import('discord.js').MessageOptions & {embeds: [EmbedBuilder & {data: import('discord.js').APIEmbed}]}} */
		const replyData = this.replyDataConstructor(msg, embedExtras, type);
		if (!this.interaction.replied && !this.interaction.deferred) {
			if (type === 'error' || this.interaction.channel && !this.interaction.channel.permissionsFor(this.interaction.client.user.id).has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]))) {
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
	 * @param {import('discord.js').APIEmbed & {additionalEmbeds?: EmbedBuilder, components?: import('discord.js').MessageOptions}} embedExtras Extra data to be passed to the embed.
	 * @param {"success"|"neutral"|"warning"|"error"} [type=neutral] Type of the message.
	 * @param  {...string} [args] Additional arguments to be passed to the locale string.
	 * @returns {Promise<import('discord.js').Message|boolean>} The message that was sent.
	 */
	async locale(code, embedExtras, type, ...args) {
		/** @type {string} */
		const localizedString = getLocale(await data.guild.get(this.interaction.guildId, 'settings.locale') ?? defaultLocale, code, ...args);
		return this.reply(localizedString, embedExtras, type);
	}
}
