const { EmbedBuilder, PermissionsBitField, ChannelType, Colors } = require('discord.js');
const { data, logger } = require('../shared.js');
const { getLocale } = require('../functions.js');
const { defaultLocale, defaultColor } = require('../settings.json');

/** Class for handling Lavaclient's Player. */
module.exports = class PlayerHandler {
	/**
	 * Create an instance of PlayerHandler.
	 * @param {import('discord.js').Client & {music: import('lavaclient').Node}} client The discord.js Client.
	 * @param {import('lavaclient').Player} player The Lavaclient Player.
	 */
	constructor(client, player) {
		this.client = client;
		this.player = player;
	}

	/**
	 * Disconnects and cleans up the player.
	 * @param {string} [channelId] The channel to disconnect from.
	 */
	async disconnect(channelId) {
		clearTimeout(this.player.timeout);
		clearTimeout(this.player.pauseTimeout);
		this.player.disconnect();
		this.client.music.destroyPlayer(this.player.guildId);
		const voiceChannel = this.client.guilds.cache.get(this.player.guildId)?.channels.cache.get(channelId ?? this.player.channelId);
		if (voiceChannel?.type === ChannelType.GuildStageVoice) {
			const permissions = this.client.guilds.cache.get(this.player.guildId)?.channels.cache.get(channelId ?? this.player.channelId).permissionsFor(this.client.user.id);
			if (!permissions?.has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]))) return;
			if (!permissions?.has(PermissionsBitField.StageModerator)) return;
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
	 * @param {string} msg The message to be used.
	 * @param {{title?: string, footer?: string, thumbnail?: string, additionalEmbeds?: EmbedBuilder[], files?: import('discord.js').FileOptions[], components?: import('discord.js').ActionRowBuilder[]}} [embedExtras] Extra data to be passed to the embed.
	 * @param {boolean} [error] Whether or not the message is an error.
	 * @returns {Object} The sendData object.
	 */
	sendDataConstructor(msg, embedExtras, error) {
		/** @type {{embeds: EmbedBuilder[], files?: import('discord.js').FileOptions[], components?: import('discord.js').ActionRowBuilder[]}} */
		const sendData = {
			embeds: [
				new EmbedBuilder()
					.setTitle(embedExtras?.title ?? null)
					.setDescription(msg)
					.setFooter({ text: embedExtras?.footer ?? null })
					.setThumbnail(embedExtras?.thumbnail ?? null)
					.setColor(error ? Colors.DarkRed : defaultColor),
				...embedExtras?.additionalEmbeds ?? [],
			],
		};
		if (embedExtras?.files) sendData.files = embedExtras.files;
		if (embedExtras?.components) sendData.components = embedExtras.components;
		return sendData;
	}

	/**
	 * Sends a message to the bound text channel.
	 * @param {string} msg The message to be used.
	 * @param {{title?: string, footer?: string, thumbnail?: string, additionalEmbeds?: EmbedBuilder[], files?: import('discord.js').FileOptions[], components?: import('discord.js').ActionRowBuilder[]}} [embedExtras] Extra data to be passed to the embed.
	 * @param {boolean} [error] Whether or not the message is an error.
	 * @returns {Promise<import('discord.js').Message>|Promise<import('discord-api-types/v10').APIMessage>|boolean} The message that was sent.
	 */
	async send(msg, embedExtras, error) {
		const sendData = this.sendDataConstructor(msg, embedExtras, error);
		/** @type {import('discord.js').TextChannel} */
		const channel = this.player.queue.channel;
		if (!channel?.permissionsFor(this.client.user.id)?.has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]))) return false;
		if (this.client.guilds.cache.get(this.player.guildId).members.me.isCommunicationDisabled()) return false;
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
	 * @param {string} code The code of the locale string to be used.
	 * @param {{title?: string, footer?: string, thumbnail?: string, additionalEmbeds?: EmbedBuilder[], files?: import('discord.js').FileOptions[], components?: import('discord.js').ActionRowBuilder[]}} [embedExtras] Extra data to be passed to the embed.
	 * @param {boolean} [error] Whether or not the message is an error.
	 * @param  {...string} [args] Additional arguments to be passed to the locale string.
	 * @returns {Promise<import('discord.js').Message>|Promise<import('discord-api-types/v10').APIMessage>|boolean} The message that was sent.
	 */
	async locale(code, embedExtras, error, ...args) {
		const localizedString = getLocale(await data.guild.get(this.player.guildId, 'settings.locale') ?? defaultLocale, code, ...args);
		return this.send(localizedString, embedExtras, error);
	}
};
