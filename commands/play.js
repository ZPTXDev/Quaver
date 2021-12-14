const { SlashCommandBuilder } = require('@discordjs/builders');
const { SpotifyItemType } = require('@lavaclient/spotify');
const { MessageEmbed, Permissions } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor } = require('../settings.json');

// credit: https://github.com/lavaclient/djs-v13-example/blob/main/src/commands/Play.ts

module.exports = {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription('Play a track.')
		.addStringOption(option =>
			option
				.setName('query')
				.setDescription('What to search for. Links from Spotify, YouTube and more are supported. Searches YouTube by default.')
				.setRequired(true))
		.addBooleanOption(option =>
			option
				.setName('insert')
				.setDescription('Whether or not to play the track next.')),
	checks: [checks.GUILD_ONLY, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		// check for connect, speak permission for channel
		const permissions = interaction.member.voice.channel.permissionsFor(interaction.client.user.id);
		if (!permissions.has(['CONNECT', 'SPEAK'])) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription('I need to be able to connect and speak in the voice channel.')
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		if (interaction.member.voice.channel.type === 'GUILD_STAGE_VOICE' && !permissions.has(Permissions.STAGE_MODERATOR)) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription('I need to be a stage moderator in the stage channel.')
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}

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
			if (interaction.member.voice.channel.type === 'GUILD_STAGE_VOICE' && !interaction.member.voice.channel.stageInstance) {
				await interaction.member.voice.channel.createStageInstance({ topic: 'Music by Quaver', privacyLevel: 'GUILD_ONLY' });
			}
		}

		const firstPosition = insert ? 1 : player.queue.tracks.length + 1;
		const endPosition = firstPosition + tracks.length - 1;

		player.queue.add(tracks, { requester: interaction.user.id, next: insert });

		const started = player.playing || player.paused;
		await interaction.editReply({
			embeds: [
				new MessageEmbed()
					.setDescription(msg)
					.setColor(defaultColor)
					.setFooter(started ? `Position: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : ''),
			],
		});
		if (!started) { await player.queue.start(); }
		const state = interaction.guild.members.cache.get(interaction.client.user.id).voice;
		if (state.channel.type === 'GUILD_STAGE_VOICE' && state.suppress) {
			await state.setSuppressed(false);
		}
	},
};