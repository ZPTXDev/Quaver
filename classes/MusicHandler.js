const { MessageEmbed, Permissions } = require('discord.js');
const { guildData, logger } = require('../shared.js');
const { getLocale } = require('../functions.js');
const { defaultLocale, defaultColor } = require('../settings.json');

module.exports = class MusicHandler {
	constructor(client, player) {
		this.client = client;
		this.player = player;
	}

	/**
	 * Disconnects and cleans up the player.
	 */
	async disconnect() {
		const { bot } = require('../main.js');
		clearTimeout(this.player.timeout);
		clearTimeout(this.player.pauseTimeout);
		this.player.disconnect();
		bot.music.destroyPlayer(this.player.guildId);
		const voiceChannel = bot.guilds.cache.get(this.player.guildId)?.channels.cache.get(this.player.channelId);
		if (voiceChannel?.type === 'GUILD_STAGE_VOICE') {
			const permissions = bot.guilds.cache.get(this.player.guildId).channels.cache.get(this.player.channelId).permissionsFor(bot.user.id);
			if (!permissions.has(['VIEW_CHANNEL', 'CONNECT', 'SPEAK'])) return;
			if (!permissions.has(Permissions.STAGE_MODERATOR)) return;
			if (voiceChannel.stageInstance?.topic === getLocale(guildData.get(`${this.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_STAGE_TOPIC')) {
				try {
					await voiceChannel.stageInstance.delete();
				}
				catch (err) {
					logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				}
			}
		}
	}

	/**
	 * Returns a sendData object.
	 * @param {string} data - The message to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @param {boolean} error - Whether or not the message is an error.
	 * @returns {Object} - The sendData object.
	 */
	sendDataConstructor(data, embedExtras, error) {
		const sendData = {
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
		if (embedExtras?.components) sendData.components = embedExtras.components;
		return sendData;
	}

	/**
	 * Sends a message to the bound text channel.
	 * @param {string} data - The message to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @param {boolean} error - Whether or not the message is an error.
	 * @returns {Message|APIMessage|boolean} - The message that was sent.
	 */
	async send(data, embedExtras, error) {
		const { bot } = require('../main.js');
		const sendData = this.sendDataConstructor(data, embedExtras, error);
		const channel = this.player.queue.channel;
		if (!channel.permissionsFor(bot.user.id).has(['VIEW_CHANNEL', 'SEND_MESSAGES'])) return false;
		if (bot.guilds.cache.get(this.player.guildId).members.cache.get(bot.user.id).isCommunicationDisabled()) return false;
		try {
			return await channel.send(sendData);
		}
		catch (err) {
			logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
			return false;
		}
	}

	/**
	 * Sends a localized message to the bound text channel.
	 * @param {string} code - The code of the locale string to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @param {boolean} error - Whether or not the message is an error.
	 * @param  {...string} args - Additional arguments to be passed to the locale string.
	 * @returns {Message|APIMessage|boolean} - The message that was sent.
	 */
	locale(code, embedExtras, error, ...args) {
		const localizedString = getLocale(guildData.get(`${this.player.guildId}.locale`) ?? defaultLocale, code, ...args);
		return this.send(localizedString, embedExtras, error);
	}
};
