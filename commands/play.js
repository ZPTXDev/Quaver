const { SlashCommandBuilder } = require('@discordjs/builders');
const { SpotifyItemType } = require('@lavaclient/spotify');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');

// credit: https://github.com/lavaclient/djs-v13-example/blob/main/src/commands/Play.ts

module.exports = {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription('Play a track.')
		.addStringOption(option =>
			option
				.setName('query')
				.setDescription('What to search for. Prepend ytsearch: for YouTube, scsearch: for SoundCloud, or specify a link.')
				.setRequired(true))
		.addBooleanOption(option =>
			option
				.setName('insert')
				.setDescription('Whether or not to play the track next.')),
	checks: [checks.GUILD_ONLY, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: ['CONNECT', 'SPEAK'],
	},
	async execute(interaction) {
		await interaction.deferReply();
		const query = interaction.options.getString('query'), insert = interaction.options.getBoolean('insert');
		let tracks = [], msg = '';
		if (interaction.client.music.spotify.isSpotifyUrl(query)) {
			const item = await interaction.client.music.spotify.load(query);
			switch (item?.type) {
				case SpotifyItemType.Track: {
					const track = await item.resolveYoutubeTrack();
					tracks = [track];
					msg = `Added **[${item.name}](${query})** to${insert ? ' start of' : ''} queue`;
					break;
				}
				case SpotifyItemType.Album:
				case SpotifyItemType.Playlist:
				case SpotifyItemType.Artist:
					tracks = await item.resolveYoutubeTracks();
					msg = `Added **${tracks.length}** tracks from **[${item.name}](${query})** to${insert ? ' start of' : ''} queue`;
					break;
				default:
					await interaction.editReply({
						embeds: [
							new MessageEmbed()
								.setDescription('Found no results from your Spotify query.')
								.setColor('DARK_RED'),
						],
					});
					return;
			}
		}
		else {
			const results = await interaction.client.music.rest.loadTracks(/^https?:\/\//.test(query) ? query : `ytsearch:${query}`);

			switch (results.loadType) {
				case 'PLAYLIST_LOADED':
					tracks = results.tracks;
					msg = `Added **${tracks.length}** tracks from **[${results.playlistInfo.name}](${query})** to${insert ? ' start of' : ''} queue`;
					break;
				case 'TRACK_LOADED':
				case 'SEARCH_RESULT': {
					const [track] = results.tracks;
					tracks = [track];
					msg = `Added **[${track.info.title}](${track.info.uri})** to${insert ? ' start of' : ''} queue`;
					break;
				}
				default:
					console.log(results);
					await interaction.editReply({
						embeds: [
							new MessageEmbed()
								.setDescription('An unexpected error occurred. Try again later.')
								.setColor('DARK_RED'),
						],
					});
					return;
			}
		}
		let player = interaction.client.music.players.get(interaction.guildId);
		if (!player?.connected) {
			player = interaction.client.music.createPlayer(interaction.guildId);
			player.queue.channel = interaction.channel;
			await player.connect(interaction.member.voice.channelId, { deafened: true });
		}

		const position = player.queue.add(tracks, { requester: interaction.user.id, insert });

		const started = player.playing || player.paused;
		await interaction.editReply({
			embeds: [
				new MessageEmbed()
					.setDescription(msg)
					.setColor('#f39bff')
					.setFooter(started ? `Position: ${insert ? '1' : position}` : ''),
			],
		});
		if (!started) { await player.queue.start(); }
	},
};