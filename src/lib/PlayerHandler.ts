import { logger } from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import { buildMessageOptions, getGuildLocaleString } from '#src/lib/util/util.js';
import { Queue } from '@lavaclient/queue';
import { ActionRowBuilder, AttachmentBuilder, ChannelType, Client, EmbedBuilder, Message, MessageActionRowComponentBuilder, PermissionsBitField, TextChannel, VoiceChannel } from 'discord.js';
import { Node, Player } from 'lavaclient';

/** Class for handling Lavaclient's Player. */
export default class PlayerHandler {
	client: Client & { music?: Node };
	player: Player & { timeout?: ReturnType<typeof setTimeout>; pauseTimeout?: ReturnType<typeof setTimeout>; queue: Queue & { channel?: TextChannel | VoiceChannel } };

	/**
	 * Create an instance of PlayerHandler.
	 * @param client - The discord.js Client.
	 * @param player - The Lavaclient Player.
	 */
	constructor(client: Client & { music?: Node }, player: Player) {
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
	async send(inputData: string | EmbedBuilder | (string | EmbedBuilder)[], { type = 'neutral', components = null, files = null }: { type?: 'success' | 'neutral' | 'warning' | 'error'; components?: ActionRowBuilder<MessageActionRowComponentBuilder>[]; files?: AttachmentBuilder[]; } = {}): Promise<Message | false> {
		const sendMsgOpts = buildMessageOptions(inputData, { type, components, files });
		const channel = this.player.queue.channel;
		if (!channel?.permissionsFor(this.client.user.id)?.has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]))) return false;
		if (this.client.guilds.cache.get(this.player.guildId).members.me.isCommunicationDisabled()) return false;
		try {
			return await channel.send(sendMsgOpts);
		}
		catch (err) {
			logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
			return false;
		}
	}

	/**
	 * Sends a localized message to the bound text channel.
	 * @param stringPath - The code of the locale string to be used.
	 * @param options - Extra data, such as type or components.
	 * @returns The message that was sent.
	 */
	async locale(stringPath: string, { vars = [], type = 'neutral', components = null, files = null }: { vars?: string[]; type?: 'success' | 'neutral' | 'warning' | 'error'; components?: ActionRowBuilder<MessageActionRowComponentBuilder>[]; files?: AttachmentBuilder[]; } = {}): Promise<Message | false> {
		const guildLocaleString = await getGuildLocaleString(this.player.guildId, stringPath, ...vars);
		return this.send(guildLocaleString, { type, components, files });
	}
}
