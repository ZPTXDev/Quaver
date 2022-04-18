const { MessageEmbed } = require('discord.js');
const { guildData, logger } = require('../shared.js');
const { getLocale } = require('../functions.js');
const { defaultLocale, defaultColor } = require('../settings.json');

module.exports = class ReplyHandler {
	constructor(interaction) {
		this.interaction = interaction;
	}

	/**
	 * Returns a replyData object.
	 * @param {string} data - The message to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @param {boolean} error - Whether or not the message is an error.
	 * @returns {Object} - The replyData object.
	 */
	replyDataConstructor(data, embedExtras, error) {
		const replyData = {
			embeds: [
				new MessageEmbed()
					.setTitle(embedExtras?.title ?? '')
					.setDescription(data)
					.setFooter({ text: embedExtras?.footer ?? '' })
					.setThumbnail(embedExtras?.thumbnail ?? '')
					.setColor(error ? 'DARK_RED' : defaultColor),
				...embedExtras?.additionalEmbeds ?? [],
			],
		};
		if (embedExtras?.components) replyData.components = embedExtras.components;
		return replyData;
	}

	/**
	 * Replies with a message.
	 * @param {string} data - The message to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @returns {Message|APIMessage|boolean} - The message that was sent.
	 */
	async reply(data, embedExtras) {
		const replyData = this.replyDataConstructor(data, embedExtras);
		if (!this.interaction.replied && !this.interaction.deferred) {
			if (this.interaction.channel && !this.interaction.channel.permissionsFor(this.interaction.client.user.id).has(['VIEW_CHANNEL', 'SEND_MESSAGES'])) {
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
	 * Replies with an error message.
	 * @param {string} data - The message to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @returns {Message|APIMessage|boolean} - The message that was sent.
	 */
	async error(data, embedExtras) {
		const replyData = this.replyDataConstructor(data, embedExtras, true);
		if (!this.interaction.replied && !this.interaction.deferred) {
			replyData.ephemeral = true;
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
	 * @param {string} code - The code of the locale string to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @param  {...string} args - Additional arguments to be passed to the locale string.
	 * @returns {Message|APIMessage|boolean} - The message that was sent.
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
	 * @returns {Message|APIMessage|boolean} - The message that was sent.
	 */
	localeError(code, embedExtras, ...args) {
		const localizedString = getLocale(guildData.get(`${this.interaction.guildId}.locale`) ?? defaultLocale, code, ...args);
		return this.error(localizedString, embedExtras);
	}
};
