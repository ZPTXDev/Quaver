const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { SpotifyItemType } = require('@lavaclient/spotify');
const { checks } = require('../enums.js');
const { defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { data } = require('../shared.js');
const PlayerHandler = require('../classes/PlayerHandler.js');

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
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('../classes/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		if (![ChannelType.GuildText, ChannelType.GuildVoice].includes(interaction.channel.type)) {
			await interaction.replyHandler.localeError('DISCORD_BOT_UNSUPPORTED_CHANNEL');
			return;
		}
		// check for connect, speak permission for channel
		const permissions = interaction.member.voice.channel.permissionsFor(interaction.client.user.id);
		if (!permissions.has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]))) {
			await interaction.replyHandler.localeError('DISCORD_BOT_MISSING_PERMISSIONS_BASIC');
			return;
		}
		if (interaction.member.voice.channel.type === ChannelType.GuildStageVoice && !permissions.has(PermissionsBitField.StageModerator)) {
			await interaction.replyHandler.localeError('DISCORD_BOT_MISSING_PERMISSIONS_STAGE');
			return;
		}
		if (interaction.guild.members.me.isCommunicationDisabled()) {
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
				case 'NO_MATCHES':
					await interaction.replyHandler.localeError('CMD_PLAY_NO_RESULTS');
					return;
				case 'LOAD_FAILED':
					await interaction.replyHandler.localeError('CMD_PLAY_LOAD_FAILED');
					return;
				default:
					await interaction.replyHandler.localeError('DISCORD_CMD_ERROR');
					return;
			}
		}

		let player = interaction.client.music.players.get(interaction.guildId);
		if (!player?.connected) {
			player = interaction.client.music.createPlayer(interaction.guildId);
			player.handler = new PlayerHandler(interaction.client, player);
			player.queue.channel = interaction.channel;
			await player.connect(interaction.member.voice.channelId, { deafened: true });
			// Ensure that Quaver destroys the player if the user leaves the channel while Quaver is queueing tracks
			// Ensure that Quaver destroys the player if Quaver gets timed out by the user while Quaver is queueing tracks
			if (!interaction.member.voice.channelId || interaction.guild.members.me.isCommunicationDisabled()) {
				await interaction.replyHandler.locale('DISCORD_INTERACTION_CANCELED', {}, interaction.user.id);
				await player.handler.disconnect();
				return;
			}
		}

		const firstPosition = insert ? 1 : player.queue.tracks.length + 1;
		const endPosition = firstPosition + tracks.length - 1;

		player.queue.add(tracks, { requester: interaction.user.id, next: insert });

		const started = player.playing || player.paused;
		await interaction.replyHandler.locale(msg, { footer: started ? `${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MISC_POSITION')}: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : null }, ...extras);
		if (!started) { await player.queue.start(); }
	},
};
