import { logger } from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import { buildMessageOptions, getGuildLocaleString } from '#src/lib/util/util.js';
import type { Message } from 'discord.js';
import { ChannelType, PermissionsBitField } from 'discord.js';
import type { MessageOptionsBuilderInputs, MessageOptionsBuilderOptions, QuaverClient, QuaverPlayer } from './util/common.d.js';

/** Class for handling Lavaclient's Player. */
export default class PlayerHandler {
	client: QuaverClient;
	player: QuaverPlayer;

	/**
	 * Create an instance of PlayerHandler.
	 * @param client - The discord.js Client.
	 * @param player - The Lavaclient Player.
	 */
	constructor(client: QuaverClient, player: QuaverPlayer) {
		this.client = client;
		this.player = player;
	}

	/**
	 * Disconnects and cleans up the player.
	 * @param channelId - The channel to disconnect from.
	 */
	async disconnect(channelId?: string): Promise<void> {
		const { io } = await import('#src/main.js');
		clearTimeout(this.player.timeout);
		clearTimeout(this.player.pauseTimeout);
		this.player.disconnect();
		await this.client.music.destroyPlayer(this.player.guildId);
		if (settings.features.web.enabled) io.to(`guild:${this.player.guildId}`).emit('playerDisconnect');
		const voiceChannel = this.client.guilds.cache.get(this.player.guildId)?.channels.cache.get(channelId ?? this.player.channelId);
		if (voiceChannel?.type !== ChannelType.GuildStageVoice) return;
		const permissions = this.client.guilds.cache.get(this.player.guildId)?.channels.cache.get(channelId ?? this.player.channelId).permissionsFor(this.client.user.id);
		if (!permissions?.has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]))) return;
		if (!permissions?.has(PermissionsBitField.StageModerator)) return;
		const me = await this.client.guilds.cache.get(this.player.guildId)?.members.fetchMe();
		if (me.isCommunicationDisabled()) return;
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
	 * @param inputData - The data to be used. Can be a string, EmbedBuilder, or an array of either.
	 * @param options - Extra data, such as type or components, or files.
	 * @returns The message that was sent.
	 */
	async send(inputData: MessageOptionsBuilderInputs, { type = 'neutral', components = null, files = null }: MessageOptionsBuilderOptions = {}): Promise<Message | undefined> {
		const sendMsgOpts = buildMessageOptions(inputData, { type, components, files });
		const channel = this.player.queue.channel;
		if (!channel?.permissionsFor(this.client.user.id)?.has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]))) return undefined;
		if (this.client.guilds.cache.get(this.player.guildId).members.me.isCommunicationDisabled()) return undefined;
		try {
			return await channel.send(sendMsgOpts);
		}
		catch (err) {
			logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
			return undefined;
		}
	}

	/**
	 * Sends a localized message to the bound text channel.
	 * @param stringPath - The code of the locale string to be used.
	 * @param options - Extra data, such as type or components.
	 * @returns The message that was sent.
	 */
	async locale(stringPath: string, { vars = [], type = 'neutral', components = null, files = null }: MessageOptionsBuilderOptions & { vars?: string[]; } = {}): Promise<Message | undefined> {
		const guildLocaleString = await getGuildLocaleString(this.player.guildId, stringPath, ...vars);
		return this.send(guildLocaleString, { type, components, files });
	}
}
