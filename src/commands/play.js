import { SlashCommandBuilder, PermissionsBitField, ChannelType } from 'discord.js';
import { SpotifyItemType } from '@lavaclient/spotify';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';
import PlayerHandler from '#lib/PlayerHandler.js';

export default {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription(getLocale(defaultLocale, 'CMD.PLAY.DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('query')
				.setDescription(getLocale(defaultLocale, 'CMD.PLAY.OPTION.QUERY'))
				.setRequired(true))
		.addBooleanOption(option =>
			option
				.setName('insert')
				.setDescription(getLocale(defaultLocale, 'CMD.PLAY.OPTION.INSERT'))),
	checks: [checks.GUILD_ONLY, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		if (![ChannelType.GuildText, ChannelType.GuildVoice].includes(interaction.channel.type)) {
			await interaction.replyHandler.locale('DISCORD.CHANNEL_UNSUPPORTED', {}, 'error');
			return;
		}
		// check for connect, speak permission for channel
		const permissions = interaction.member.voice.channel.permissionsFor(interaction.client.user.id);
		if (!permissions.has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]))) {
			await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC', {}, 'error');
			return;
		}
		if (interaction.member.voice.channel.type === ChannelType.GuildStageVoice && !permissions.has(PermissionsBitField.StageModerator)) {
			await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.STAGE', {}, 'error');
			return;
		}
		if (interaction.guild.members.me.isCommunicationDisabled()) {
			await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT', {}, 'error');
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
					msg = insert ? 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.INSERTED' : 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT';
					extras = [item.name, query];
					break;
				}
				case SpotifyItemType.Album:
				case SpotifyItemType.Playlist:
				case SpotifyItemType.Artist:
					tracks = await item.resolveYoutubeTracks();
					msg = insert ? 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.INSERTED' : 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.DEFAULT';
					extras = [tracks.length, item.name, query];
					break;
				default:
					await interaction.replyHandler.locale('CMD.PLAY.RESPONSE.NO_RESULTS.SPOTIFY', {}, 'error');
					return;
			}
		}
		else {
			const results = await interaction.client.music.rest.loadTracks(/^https?:\/\//.test(query) ? query : `ytsearch:${query}`);
			switch (results.loadType) {
				case 'PLAYLIST_LOADED':
					tracks = results.tracks;
					msg = insert ? 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.INSERTED' : 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.DEFAULT';
					extras = [tracks.length, results.playlistInfo.name, query];
					break;
				case 'TRACK_LOADED':
				case 'SEARCH_RESULT': {
					const [track] = results.tracks;
					tracks = [track];
					msg = insert ? 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.INSERTED' : 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT';
					extras = [track.info.title, track.info.uri];
					break;
				}
				case 'NO_MATCHES':
					await interaction.replyHandler.locale('CMD.PLAY.RESPONSE.NO_RESULTS.DEFAULT', {}, 'error');
					return;
				case 'LOAD_FAILED':
					await interaction.replyHandler.locale('CMD.PLAY.RESPONSE.LOAD_FAILED', {}, 'error');
					return;
				default:
					await interaction.replyHandler.locale('DISCORD.GENERIC_ERROR', {}, 'error');
					return;
			}
		}

		let player = interaction.client.music.players.get(interaction.guildId);
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
				if (interaction.guild) timedOut ? await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT', {}, 'error') : await interaction.replyHandler.locale('DISCORD.INTERACTION.CANCELED', {}, 'neutral', interaction.user.id);
				await player.handler.disconnect();
				return;
			}
		}

		const firstPosition = insert ? 1 : player.queue.tracks.length + 1;
		const endPosition = firstPosition + tracks.length - 1;

		player.queue.add(tracks, { requester: interaction.user.id, next: insert });

		const started = player.playing || player.paused;
		await interaction.replyHandler.locale(msg, { footer: started ? `${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MISC.POSITION')}: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : null }, 'success', ...extras);
		if (!started) { await player.queue.start(); }
	},
};
