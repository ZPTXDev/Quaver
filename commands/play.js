const { SlashCommandBuilder } = require('@discordjs/builders');
const { SpotifyItemType } = require('@lavaclient/spotify');
const { Embed, Permissions } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../data.js');

// credit: https://github.com/lavaclient/djs-v13-example/blob/main/src/commands/Play.ts

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
			await interaction.reply({
				embeds: [
					new Embed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_BOT_MISSING_PERMISSIONS_BASIC'))
						.setColor('DarkRed'),
				],
				ephemeral: true,
			});
			return;
		}
		if (interaction.member.voice.channel.type === 'GUILD_STAGE_VOICE' && !permissions.has(Permissions.STAGE_MODERATOR)) {
			await interaction.reply({
				embeds: [
					new Embed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_BOT_MISSING_PERMISSIONS_STAGE'))
						.setColor('DarkRed'),
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
					msg = getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, insert ? 'MUSIC_QUEUE_ADDED_INSERT' : 'MUSIC_QUEUE_ADDED', item.name, query);
					break;
				}
				case SpotifyItemType.Album:
				case SpotifyItemType.Playlist:
				case SpotifyItemType.Artist:
					tracks = await item.resolveYoutubeTracks();
					msg = getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, insert ? 'MUSIC_QUEUE_ADDED_MULTI_INSERT' : 'MUSIC_QUEUE_ADDED_MULTI', tracks.length, item.name, query);
					break;
				default:
					await interaction.editReply({
						embeds: [
							new Embed()
								.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_PLAY_SPOTIFY_NO_RESULTS'))
								.setColor('DarkRed'),
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
					msg = getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, insert ? 'MUSIC_QUEUE_ADDED_MULTI_INSERT' : 'MUSIC_QUEUE_ADDED_MULTI', tracks.length, results.playlistInfo.name, query);
					break;
				case 'TRACK_LOADED':
				case 'SEARCH_RESULT': {
					const [track] = results.tracks;
					tracks = [track];
					msg = getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, insert ? 'MUSIC_QUEUE_ADDED_INSERT' : 'MUSIC_QUEUE_ADDED', track.info.title, track.info.uri);
					break;
				}
				default:
					console.log(results);
					await interaction.editReply({
						embeds: [
							new Embed()
								.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_CMD_ERROR'))
								.setColor('DarkRed'),
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
			// that kid left while we were busy bruh
			if (!interaction.member.voice.channelId) {
				player.disconnect();
				interaction.client.music.destroyPlayer(interaction.guildId);
				await interaction.editReply({
					embeds: [
						new Embed()
							.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_INTERACTION_CANCELED', interaction.user.id))
							.setColor(defaultColor),
					],
				});
				return;
			}
			if (interaction.member.voice.channel.type === 'GUILD_STAGE_VOICE' && !interaction.member.voice.channel.stageInstance) {
				await interaction.member.voice.channel.createStageInstance({ topic: getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_STAGE_TOPIC'), privacyLevel: 'GUILD_ONLY' });
			}
		}

		const firstPosition = insert ? 1 : player.queue.tracks.length + 1;
		const endPosition = firstPosition + tracks.length - 1;

		player.queue.add(tracks, { requester: interaction.user.id, next: insert });

		const started = player.playing || player.paused;
		await interaction.editReply({
			embeds: [
				new Embed()
					.setDescription(msg)
					.setColor(defaultColor)
					.setFooter({ text: started ? `${getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'POSITION')}: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : '' }),
			],
		});
		if (!started) { await player.queue.start(); }
		const state = interaction.guild.members.cache.get(interaction.client.user.id).voice;
		if (state.channel.type === 'GUILD_STAGE_VOICE' && state.suppress) {
			await state.setSuppressed(false);
		}
	},
};