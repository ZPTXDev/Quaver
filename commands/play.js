const { SlashCommandBuilder } = require('@discordjs/builders');
const { SpotifyItemType } = require('@lavaclient/spotify');
const { Permissions } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { logger, guildData } = require('../shared.js');
const MusicHandler = require('../classes/MusicHandler.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription(getLocale(defaultLocale, 'CMD_PLAY_DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('query')
				.setDescription(getLocale(defaultLocale, 'CMD_PLAY_OPTION_QUERY'))
				.setRequired(true))
		.addBooleanOption(option =>
			option
				.setName('insert')
				.setDescription(getLocale(defaultLocale, 'CMD_PLAY_OPTION_INSERT'))),
	checks: [checks.GUILD_ONLY, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		// check for connect, speak permission for channel
		const permissions = interaction.member.voice.channel.permissionsFor(interaction.client.user.id);
		if (!permissions.has(['VIEW_CHANNEL', 'CONNECT', 'SPEAK'])) {
			await interaction.replyHandler.localeError('DISCORD_BOT_MISSING_PERMISSIONS_BASIC');
			return;
		}
		if (interaction.member.voice.channel.type === 'GUILD_STAGE_VOICE' && !permissions.has(Permissions.STAGE_MODERATOR)) {
			await interaction.replyHandler.localeError('DISCORD_BOT_MISSING_PERMISSIONS_STAGE');
			return;
		}
		if (interaction.guild.members.cache.get(interaction.client.user.id).isCommunicationDisabled()) {
			await interaction.replyHandler.localeError('DISCORD_BOT_TIMED_OUT');
			return;
		}

		await interaction.deferReply();
		const query = interaction.options.getString('query'), insert = interaction.options.getBoolean('insert');
		let tracks = [], msg = '', extras = [];
		if (interaction.client.music.spotify.isSpotifyUrl(query)) {
			const item = await interaction.client.music.spotify.load(query);
			switch (item?.type) {
				case SpotifyItemType.Track: {
					const track = await item.resolveYoutubeTrack();
					tracks = [track];
					msg = insert ? 'MUSIC_QUEUE_ADDED_INSERT' : 'MUSIC_QUEUE_ADDED';
					extras = [item.name, query];
					break;
				}
				case SpotifyItemType.Album:
				case SpotifyItemType.Playlist:
				case SpotifyItemType.Artist:
					tracks = await item.resolveYoutubeTracks();
					msg = insert ? 'MUSIC_QUEUE_ADDED_MULTI_INSERT' : 'MUSIC_QUEUE_ADDED_MULTI';
					extras = [tracks.length, item.name, query];
					break;
				default:
					await interaction.replyHandler.localeError('CMD_PLAY_SPOTIFY_NO_RESULTS');
					return;
			}
		}
		else {
			const results = await interaction.client.music.rest.loadTracks(/^https?:\/\//.test(query) ? query : `ytsearch:${query}`);
			switch (results.loadType) {
				case 'PLAYLIST_LOADED':
					tracks = results.tracks;
					msg = insert ? 'MUSIC_QUEUE_ADDED_MULTI_INSERT' : 'MUSIC_QUEUE_ADDED_MULTI';
					extras = [tracks.length, results.playlistInfo.name, query];
					break;
				case 'TRACK_LOADED':
				case 'SEARCH_RESULT': {
					const [track] = results.tracks;
					tracks = [track];
					msg = insert ? 'MUSIC_QUEUE_ADDED_INSERT' : 'MUSIC_QUEUE_ADDED';
					extras = [track.info.title, track.info.uri];
					break;
				}
				default:
					await interaction.replyHandler.localeError('DISCORD_CMD_ERROR');
					return;
			}
		}

		let player = interaction.client.music.players.get(interaction.guildId);
		if (!player?.connected) {
			player = interaction.client.music.createPlayer(interaction.guildId);
			player.musicHandler = new MusicHandler(interaction.client, player);
			player.queue.channel = interaction.channel;
			await player.connect(interaction.member.voice.channelId, { deafened: true });
			// that kid left while we were busy bruh
			if (!interaction.member.voice.channelId) {
				await interaction.replyHandler.locale('DISCORD_INTERACTION_CANCELED', {}, interaction.user.id);
				await player.musicHandler.disconnect();
				return;
			}
			if (interaction.member.voice.channel.type === 'GUILD_STAGE_VOICE' && !interaction.member.voice.channel.stageInstance?.topic) {
				try {
					await interaction.member.voice.channel.createStageInstance({ topic: getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_STAGE_TOPIC'), privacyLevel: 'GUILD_ONLY' });
				}
				catch (err) {
					logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				}
			}
		}

		const firstPosition = insert ? 1 : player.queue.tracks.length + 1;
		const endPosition = firstPosition + tracks.length - 1;

		player.queue.add(tracks, { requester: interaction.user.id, next: insert });

		const started = player.playing || player.paused;
		await interaction.replyHandler.locale(msg, { footer: started ? `${getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MISC_POSITION')}: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : '' }, ...extras);
		if (!started) { await player.queue.start(); }
		const state = interaction.guild.members.cache.get(interaction.client.user.id).voice;
		if (interaction.member.voice.channel.type === 'GUILD_STAGE_VOICE' && state.suppress) {
			await state.setSuppressed(false);
		}
	},
};
