const { MessageEmbed } = require('discord.js');
const { guildData } = require('../shared.js');
const { getLocale } = require('../functions.js');
const { defaultLocale, defaultColor } = require('../settings.json');

module.exports = class ReplyHandler {
	constructor(interaction) {
		this.interaction = interaction;
	}

	/**
	 * Replies with a message.
	 * @param {string} data - The message to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @returns {Promise<Message|APIMessage>} - The message that was sent.
	 */
	reply(data, embedExtras) {
		const replyData = {
			embeds: [
				new MessageEmbed()
					.setTitle(embedExtras?.title ?? '')
					.setDescription(data)
					.setFooter({ text: embedExtras?.footer ?? '' })
					.setThumbnail(embedExtras?.thumbnail ?? '')
					.setColor(defaultColor),
				...embedExtras?.additionalEmbeds ?? [],
			],
		};
		if (embedExtras.components) replyData.components = embedExtras.components;
		if (!this.interaction.replied && !this.interaction.deferred) {
			if (!this.interaction.channel.permissionsFor(this.interaction.client.user.id).has(['VIEW_CHANNEL', 'SEND_MESSAGES'])) {
				replyData.ephemeral = true;
			}
			return this.interaction.reply(replyData);
		}
		else {
			return this.interaction.editReply(replyData);
		}
	}

	/**
	 * Replies with an error message.
	 * @param {string} data - The message to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @returns {Promise<Message|APIMessage>} - The message that was sent.
	 */
	error(data, embedExtras) {
		const replyData = {
			embeds: [
				new MessageEmbed()
					.setTitle(embedExtras?.title ?? '')
					.setDescription(data)
					.setFooter({ text: embedExtras?.footer ?? '' })
					.setThumbnail(embedExtras?.thumbnail ?? '')
					.setColor('DARK_RED'),
				...embedExtras?.additionalEmbeds ?? [],
			],
		};
		if (embedExtras.components) replyData.components = embedExtras.components;
		if (!this.interaction.replied && !this.interaction.deferred) {
			replyData.ephemeral = true;
			return this.interaction.reply(replyData);
		}
		else {
			return this.interaction.editReply(replyData);
		}
	}

	/**
	 * Replies with a localized message.
	 * @param {string} code - The code of the locale string to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @param  {...string} args - Additional arguments to be passed to the locale string.
	 * @returns {Promise<Message|APIMessage>} - The message that was sent.
	 */
	locale(code, embedExtras, ...args) {
		const localizedString = getLocale(guildData.get(`${this.interaction.guildId}.locale`) ?? defaultLocale, code, ...args);
		return this.reply(localizedString, embedExtras);
	}

	/**
	 * Replies with a localized error message.
	 * @param {string} code - The code of the locale string to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @param  {...string} args - Additional arguments to be passed to the locale string.
	 * @returns {Promise<Message|APIMessage>} - The message that was sent.
	 */
	localeError(code, embedExtras, ...args) {
		const localizedString = getLocale(guildData.get(`${this.interaction.guildId}.locale`) ?? defaultLocale, code, ...args);
		return this.error(localizedString, embedExtras);
	}
};
