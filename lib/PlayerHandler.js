import { PermissionsBitField, ChannelType } from 'discord.js';
import { features } from '#settings';
import { logger } from '#lib/util/common.js';
import { getGuildLocaleString, buildMessageOptions } from '#lib/util/util.js';

/** Class for handling Lavaclient's Player. */
export default class PlayerHandler {
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
		const { io } = await import('#src/main.js');
		clearTimeout(this.player.timeout);
		clearTimeout(this.player.pauseTimeout);
		this.player.disconnect();
		await this.client.music.destroyPlayer(this.player.guildId);
		if (features.web.enabled) io.to(`guild:${this.player.guildId}`).emit('playerDisconnect');
		const voiceChannel = this.client.guilds.cache.get(this.player.guildId)?.channels.cache.get(channelId ?? this.player.channelId);
		if (voiceChannel?.type !== ChannelType.GuildStageVoice) return;
		const permissions = this.client.guilds.cache.get(this.player.guildId)?.channels.cache.get(channelId ?? this.player.channelId).permissionsFor(this.client.user.id);
		if (!permissions?.has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]))) return;
		if (!permissions?.has(PermissionsBitField.StageModerator)) return;
		if (this.client.guilds.cache.get(this.player.guildId)?.members.me.isCommunicationDisabled()) return;
		if (voiceChannel.stageInstance?.topic !== await getGuildLocaleString(this.player.guildId, 'MISC.STAGE_TOPIC')) return;
		try {
			await voiceChannel.stageInstance.delete();
		}
		catch (err) {
			logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
		}
	}

	/**
	 * Sends a message to the bound text channel.
	 * @param {string|EmbedBuilder|string[]|EmbedBuilder[]} msgData The data to be used. Can be a string, EmbedBuilder, or an array of either.
	 * @param {{type?: "success"|"neutral"|"warning"|"error", components?: import('discord.js').ActionRowBuilder[], files?: import('discord.js').Attachment[]}} optionals Extra data, such as type or components.
	 * @returns {Promise<import('discord.js').Message>|false} The message that was sent.
	 */
	async send(msgData, { type = 'neutral', components = null, files = null } = {}) {
		/** @type {import('discord.js').MessageOptions & {embeds: [EmbedBuilder & {data: import('discord.js').APIEmbed}]}} */
		const sendData = buildMessageOptions(msgData, { type, components, files });
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
	 * @param {{type?: "success"|"neutral"|"warning"|"error", args?: string[], components?: import('discord.js').ActionRowBuilder[], files?: import('discord.js').Attachment[]}} optionals Extra data, such as type or components.
	 * @returns {Promise<import('discord.js').Message>|false} The message that was sent.
	 */
	async locale(stringPath, { vars = [], type = 'neutral', components = null, files = null } = {}) {
		return this.send(await getGuildLocaleString(this.player.guildId, stringPath, ...vars), { type, components, files });
	}
}
