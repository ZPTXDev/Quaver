const { MessageEmbed, Permissions } = require('discord.js');
const { data, logger } = require('../shared.js');
const { getLocale } = require('../functions.js');
const { defaultLocale, defaultColor } = require('../settings.json');

module.exports = class PlayerHandler {
	constructor(client, player) {
		this.client = client;
		this.player = player;
	}

	/**
	 * Disconnects and cleans up the player.
	 */
	async disconnect() {
		clearTimeout(this.player.timeout);
		clearTimeout(this.player.pauseTimeout);
		this.player.disconnect();
		this.client.music.destroyPlayer(this.player.guildId);
		const voiceChannel = this.client.guilds.cache.get(this.player.guildId)?.channels.cache.get(this.player.channelId);
		if (voiceChannel?.type === 'GUILD_STAGE_VOICE') {
			const permissions = this.client.guilds.cache.get(this.player.guildId).channels.cache.get(this.player.channelId).permissionsFor(this.client.user.id);
			if (!permissions.has(['VIEW_CHANNEL', 'CONNECT', 'SPEAK'])) return;
			if (!permissions.has(Permissions.STAGE_MODERATOR)) return;
			if (voiceChannel.stageInstance?.topic === getLocale(await data.guild.get(this.player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_STAGE_TOPIC')) {
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
	 * @param {string} msg - The message to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @param {boolean} error - Whether or not the message is an error.
	 * @returns {Object} - The sendData object.
	 */
	sendDataConstructor(msg, embedExtras, error) {
		const sendData = {
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
		if (embedExtras?.components) sendData.components = embedExtras.components;
		return sendData;
	}

	/**
	 * Sends a message to the bound text channel.
	 * @param {string} msg - The message to be used.
	 * @param {Object} embedExtras - Extra data to be passed to the embed.
	 * @param {boolean} error - Whether or not the message is an error.
	 * @returns {Message|APIMessage|boolean} - The message that was sent.
	 */
	async send(msg, embedExtras, error) {
		const sendData = this.sendDataConstructor(msg, embedExtras, error);
		const channel = this.player.queue.channel;
		if (!channel.permissionsFor(this.client.user.id).has(['VIEW_CHANNEL', 'SEND_MESSAGES'])) return false;
		if (this.client.guilds.cache.get(this.player.guildId).members.cache.get(this.client.user.id).isCommunicationDisabled()) return false;
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
	async locale(code, embedExtras, error, ...args) {
		const localizedString = getLocale(await data.guild.get(this.player.guildId, 'settings.locale') ?? defaultLocale, code, ...args);
		return this.send(localizedString, embedExtras, error);
	}
};
