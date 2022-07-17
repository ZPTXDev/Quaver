const { Permissions } = require('discord.js');
const { data } = require('../../shared.js');
const { getLocale } = require('../../functions.js');
const { checks } = require('../../enums.js');
const { defaultLocale } = require('../../settings.json');
const PlayerHandler = require('../../classes/PlayerHandler.js');

module.exports = {
	name: 'play',
	/** @param {import('discord.js').SelectMenuInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('../../classes/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		if (interaction.customId.split('_')[1] !== interaction.user.id) {
			await interaction.replyHandler.localeError('DISCORD_INTERACTION_WRONG_USER');
			return;
		}
		const tracks = interaction.values;
		let player = interaction.client.music.players.get(interaction.guildId);
		if (!interaction.member?.voice.channelId) {
			await interaction.replyHandler.localeError(checks.IN_VOICE);
			return;
		}
		if (player && interaction.member?.voice.channelId !== player.channelId) {
			await interaction.replyHandler.localeError(checks.IN_SESSION_VOICE);
			return;
		}
		// check for connect, speak permission for channel
		const permissions = interaction.member?.voice.channel.permissionsFor(interaction.client.user.id);
		if (!permissions.has(['VIEW_CHANNEL', 'CONNECT', 'SPEAK'])) {
			await interaction.replyHandler.localeError('DISCORD_BOT_MISSING_PERMISSIONS_BASIC');
			return;
		}
		if (interaction.member?.voice.channel.type === 'GUILD_STAGE_VOICE' && !permissions.has(Permissions.STAGE_MODERATOR)) {
			await interaction.replyHandler.localeError('DISCORD_BOT_MISSING_PERMISSIONS_STAGE');
			return;
		}
		if (interaction.guild.members.cache.get(interaction.client.user.id).isCommunicationDisabled()) {
			await interaction.replyHandler.localeError('DISCORD_BOT_TIMED_OUT');
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
			msg = 'MUSIC_QUEUE_ADDED';
			extras = [resolvedTracks[0].info.title, resolvedTracks[0].info.uri];
		}
		else {
			msg = 'MUSIC_QUEUE_ADDED_MULTI';
			extras = [resolvedTracks.length, getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_SEARCH'), ''] ;
		}
		if (!player?.connected) {
			player = interaction.client.music.createPlayer(interaction.guildId);
			player.handler = new PlayerHandler(interaction.client, player);
			player.queue.channel = interaction.channel;
			await player.connect(interaction.member.voice.channelId, { deafened: true });
			// that kid left while we were busy bruh
			if (!interaction.member.voice.channelId) {
				await player.handler.disconnect();
				await interaction.replyHandler.locale('DISCORD_INTERACTION_CANCELED', { components: [] }, interaction.user.id);
				return;
			}
		}

		const firstPosition = player.queue.tracks.length + 1;
		const endPosition = firstPosition + resolvedTracks.length - 1;
		player.queue.add(resolvedTracks, { requester: interaction.user.id });

		const started = player.playing || player.paused;
		await interaction.replyHandler.locale(msg, { footer: started ? `${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MISC_POSITION')}: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : '', components: [] }, ...extras);
		if (!started) { await player.queue.start(); }
		const state = interaction.guild.members.cache.get(interaction.client.user.id).voice;
		if (state.channel.type === 'GUILD_STAGE_VOICE' && state.suppress) {
			await state.setSuppressed(false);
		}
	},
};
