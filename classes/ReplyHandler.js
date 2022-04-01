const { MessageEmbed } = require('discord.js');
const { guildData } = require('../shared.js');
const { getLocale } = require('../functions.js');
const { defaultLocale, defaultColor } = require('../settings.json');

module.exports = class ReplyHandler {
	constructor(interaction) {
		this.interaction = interaction;
	}

	/**
	 * Replies with a localized message.
	 * @param {string} code - The code of the locale string to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @param  {...string} args - Additional arguments to be passed to the locale string.
	 * @returns {Promise<Message|APIMessage>} - The message that was sent.
	 */
	localeReply(code, embedExtras, ...args) {
		const localizedString = getLocale(guildData.get(`${this.interaction.guildId}.locale`) ?? defaultLocale, code, ...args);
		const replyData = {
			embeds: [
				new MessageEmbed()
					.setTitle(embedExtras?.title ?? '')
					.setDescription(localizedString)
					.setFooter({ text: embedExtras?.footer ?? '' })
					.setThumbnail(embedExtras?.thumbnail ?? '')
					.setColor(defaultColor),
			],
		};
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
	 * Replies with a localized error message.
	 * @param {string} code - The code of the locale string to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @param  {...string} args - Additional arguments to be passed to the locale string.
	 * @returns {Promise<Message|APIMessage>} - The message that was sent.
	 */
	localeErrorReply(code, embedExtras, ...args) {
		const localizedString = getLocale(guildData.get(`${this.interaction.guildId}.locale`) ?? defaultLocale, code, ...args);
		const replyData = {
			embeds: [
				new MessageEmbed()
					.setTitle(embedExtras?.title ?? '')
					.setDescription(localizedString)
					.setFooter({ text: embedExtras?.footer ?? '' })
					.setThumbnail(embedExtras?.thumbnail ?? '')
					.setColor('DARK_RED'),
			],
		};
		if (!this.interaction.replied && !this.interaction.deferred) {
			replyData.ephemeral = true;
			return this.interaction.reply(replyData);
		}
		else {
			return this.interaction.editReply(replyData);
		}
	}
};
