const { MessageEmbed } = require('discord.js');
const { data, logger } = require('../shared.js');
const { getLocale } = require('../functions.js');
const { defaultLocale, defaultColor } = require('../settings.json');

/** Class for handling replies to interactions. */
module.exports = class ReplyHandler {
	/**
	 * Create an instance of ReplyHandler.
	 * @param {import('discord.js').CommandInteraction} interaction The discord.js CommandInteraction object.
	 */
	constructor(interaction) {
		this.interaction = interaction;
	}

	/**
	 * Returns a replyData object.
	 * @param {string} msg The message to be used.
	 * @param {{title?: string, footer?: string, thumbnail?: string, additionalEmbeds?: MessageEmbed[], components?: import('discord.js').MessageActionRow[]}} [embedExtras] Extra data to be passed to the embed.
	 * @param {boolean} [error] Whether or not the message is an error.
	 * @returns {Object} The replyData object.
	 */
	replyDataConstructor(msg, embedExtras, error) {
		/** @type {{embeds: MessageEmbed[], components: import('discord.js').MessageActionRow[]}} */
		const replyData = {
			embeds: [
				new MessageEmbed()
					.setTitle(embedExtras?.title ?? '')
					.setDescription(msg)
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
	 * @param {string} msg The message to be used.
	 * @param {{title?: string, footer?: string, thumbnail?: string, additionalEmbeds?: MessageEmbed[], components?: import('discord.js').MessageActionRow[]}} [embedExtras] Extra data to be passed to the embed.
	 * @returns {import('discord.js').Message|import('discord-api-types/v10').APIMessage|boolean} The message that was sent.
	 */
	async reply(msg, embedExtras) {
		const replyData = this.replyDataConstructor(msg, embedExtras);
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
	 * @param {string} msg The message to be used.
	 * @param {{title?: string, footer?: string, thumbnail?: string, additionalEmbeds?: MessageEmbed[], components?: import('discord.js').MessageActionRow[]}} [embedExtras] Extra data to be passed to the embed.
	 * @returns {import('discord.js').Message|import('discord-api-types/v10').APIMessage|boolean} The message that was sent.
	 */
	async error(msg, embedExtras) {
		const replyData = this.replyDataConstructor(msg, embedExtras, true);
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
	 * @param {string} code The code of the locale string to be used.
	 * @param {{title?: string, footer?: string, thumbnail?: string, additionalEmbeds?: MessageEmbed[], components?: import('discord.js').MessageActionRow[]}} [embedExtras] Extra data to be passed to the embed.
	 * @param  {...string} [args] Additional arguments to be passed to the locale string.
	 * @returns {import('discord.js').Message|import('discord-api-types/v10').APIMessage|boolean} The message that was sent.
	 */
	async locale(code, embedExtras, ...args) {
		const localizedString = getLocale(await data.guild.get(this.interaction.guildId, 'settings.locale') ?? defaultLocale, code, ...args);
		return this.reply(localizedString, embedExtras);
	}

	/**
	 * Replies with a localized error message.
	 * @param {string} code The code of the locale string to be used.
	 * @param {{title?: string, footer?: string, thumbnail?: string, additionalEmbeds?: MessageEmbed[], components?: import('discord.js').MessageActionRow[]}} [embedExtras] Extra data to be passed to the embed.
	 * @param  {...string} [args] Additional arguments to be passed to the locale string.
	 * @returns {import('discord.js').Message|import('discord-api-types/v10').APIMessage|boolean} The message that was sent.
	 */
	async localeError(code, embedExtras, ...args) {
		const localizedString = getLocale(await data.guild.get(this.interaction.guildId, 'settings.locale') ?? defaultLocale, code, ...args);
		return this.error(localizedString, embedExtras);
	}
};
