import { PermissionsBitField, ChannelType } from 'discord.js';
import { defaultLocale } from '#settings';
import { data } from '#lib/util/common.js';
import { getLocale } from '#lib/util/util.js';
import { checks } from '#lib/util/constants.js';
import PlayerHandler from '#lib/PlayerHandler.js';

export default {
	name: 'play',
	/** @param {import('discord.js').SelectMenuInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		if (interaction.customId.split('_')[1] !== interaction.user.id) {
			await interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', {}, 'error');
			return;
		}
		const tracks = interaction.values;
		let player = interaction.client.music.players.get(interaction.guildId);
		if (!interaction.member?.voice.channelId) {
			await interaction.replyHandler.locale(checks.IN_VOICE, {}, 'error');
			return;
		}
		if (player && interaction.member?.voice.channelId !== player.channelId) {
			await interaction.replyHandler.locale(checks.IN_SESSION_VOICE, {}, 'error');
			return;
		}
		// check for connect, speak permission for channel
		const permissions = interaction.member?.voice.channel.permissionsFor(interaction.client.user.id);
		if (!permissions.has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]))) {
			await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC', {}, 'error');
			return;
		}
		if (interaction.member?.voice.channel.type === ChannelType.GuildStageVoice && !permissions.has(PermissionsBitField.StageModerator)) {
			await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.STAGE', {}, 'error');
			return;
		}
		if (interaction.guild.members.me.isCommunicationDisabled()) {
			await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT', {}, 'error');
			return;
		}

		await interaction.deferUpdate();
		const resolvedTracks = [];
		for (const track of tracks) {
			const results = await interaction.client.music.rest.loadTracks(track);
			if (results.loadType === 'TRACK_LOADED') {
				resolvedTracks.push(results.tracks[0]);
			}
		}
		let msg, extras = [];
		if (resolvedTracks.length === 1) {
			msg = 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT';
			extras = [resolvedTracks[0].info.title, resolvedTracks[0].info.uri];
		}
		else {
			msg = 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.DEFAULT';
			extras = [resolvedTracks.length, getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MISC.YOUR_SEARCH'), ''] ;
		}
		if (!player?.connected) {
			player = interaction.client.music.createPlayer(interaction.guildId);
			player.handler = new PlayerHandler(interaction.client, player);
			player.queue.channel = interaction.channel;
			await player.connect(interaction.member.voice.channelId, { deafened: true });
			// Ensure that Quaver destroys the player if the user leaves the channel while Quaver is queuing tracks
			// Ensure that Quaver destroys the player if Quaver gets timed out by the user while Quaver is queuing tracks
			// Ensure that Quaver destroys the player if Quaver gets kicked or banned by the user while Quaver is queuing tracks
			const timedOut = interaction.guild?.members.me.isCommunicationDisabled();
			if (!interaction.member.voice.channelId || timedOut || !interaction.guild) {
				if (interaction.guild) timedOut ? await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT', { components: [] }, 'error') : await interaction.replyHandler.locale('DISCORD.INTERACTION.CANCELED', { components: [] }, 'neutral', interaction.user.id);
				await player.handler.disconnect();
				return;
			}
		}

		const firstPosition = player.queue.tracks.length + 1;
		const endPosition = firstPosition + resolvedTracks.length - 1;
		player.queue.add(resolvedTracks, { requester: interaction.user.id });

		const started = player.playing || player.paused;
		await interaction.replyHandler.locale(msg, { footer: started ? `${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MISC.POSITION')}: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : null, components: [] }, 'success', ...extras);
		if (!started) { await player.queue.start(); }
	},
};
