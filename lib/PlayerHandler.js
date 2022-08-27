import { EmbedBuilder, PermissionsBitField, ChannelType } from 'discord.js';
import { colors, features } from '#settings';
import { logger } from '#lib/util/common.js';
import { getGuildLocale } from '#lib/util/util.js';

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
		if (voiceChannel.stageInstance?.topic !== await getGuildLocale(this.player.guildId, 'MISC.STAGE_TOPIC')) return;
		try {
			await voiceChannel.stageInstance.delete();
		}
		catch (err) {
			logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
		}
	}

	/**
	 * Returns a sendData object.
	 * @private
	 * @param {string} msg The message to be used.
	 * @param {import('discord.js').APIEmbed & {additionalEmbeds?: EmbedBuilder, files?: import('discord.js').MessageOptions, components?: import('discord.js').MessageOptions}} embedExtras Extra data to be passed to the embed.
	 * @param {"success"|"neutral"|"warning"|"error"} [type=neutral] Type of the message.
	 * @returns {import('discord.js').MessageOptions & {embeds: [EmbedBuilder]}} The sendData object.
	 */
	sendDataConstructor(msg, embedExtras, type = 'neutral') {
		/** @type {import('discord.js').MessageOptions & {embeds: [EmbedBuilder]}} */
		const sendData = {
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
		if (embedExtras?.files) sendData.files = embedExtras.files;
		if (embedExtras?.components) sendData.components = embedExtras.components;
		return sendData;
	}

	/**
	 * Sends a message to the bound text channel.
	 * @param {string} msg The message to be used.
	 * @param {import('discord.js').APIEmbed & {additionalEmbeds?: EmbedBuilder, files?: import('discord.js').MessageOptions, components?: import('discord.js').MessageOptions}} embedExtras Extra data to be passed to the embed.
	 * @param {"success"|"neutral"|"warning"|"error"} [type=neutral] Type of the message.
	 * @returns {Promise<import('discord.js').Message>|false} The message that was sent.
	 */
	async send(msg, embedExtras, type = 'neutral') {
		/** @type {import('discord.js').MessageOptions & {embeds: [EmbedBuilder & {data: import('discord.js').APIEmbed}]}} */
		const sendData = this.sendDataConstructor(msg, embedExtras, type);
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
	 * @param {import('discord.js').APIEmbed & {additionalEmbeds?: EmbedBuilder, components?: import('discord.js').MessageOptions}} embedExtras Extra data to be passed to the embed.
	 * @param {"success"|"neutral"|"warning"|"error"} [type=neutral] Type of the message.
	 * @param  {...string} [args] Additional arguments to be passed to the locale string.
	 * @returns {Promise<import('discord.js').Message>|false} The message that was sent.
	 */
	async locale(code, embedExtras, type = 'neutral', ...args) {
		/** @type {string} */
		return this.send(await getGuildLocale(this.player.guildId, code, ...args), embedExtras, type);
	}
}
