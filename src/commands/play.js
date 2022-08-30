import { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder } from 'discord.js';
import { SpotifyItemType } from '@lavaclient/spotify';
import { defaultLocale, features } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getGuildLocale, getLocale } from '#lib/util/util.js';
import PlayerHandler from '#lib/PlayerHandler.js';

export default {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription(getLocale(defaultLocale, 'CMD.PLAY.DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('query')
				.setDescription(getLocale(defaultLocale, 'CMD.PLAY.OPTION.QUERY'))
				.setRequired(true)
				.setAutocomplete(true))
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
		const { bot, io } = await import('#src/main.js');
		if (![ChannelType.GuildText, ChannelType.GuildVoice].includes(interaction.channel.type)) return interaction.replyHandler.locale('DISCORD.CHANNEL_UNSUPPORTED', { type: 'error' });
		// check for connect, speak permission for channel
		const permissions = interaction.member.voice.channel.permissionsFor(interaction.client.user.id);
		if (!permissions.has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]))) return interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC', { type: 'error' });
		if (interaction.member.voice.channel.type === ChannelType.GuildStageVoice && !permissions.has(PermissionsBitField.StageModerator)) return interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.STAGE', { type: 'error' });
		if (interaction.guild.members.me.isCommunicationDisabled()) return interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT', { type: 'error' });

		await interaction.deferReply();
		const query = interaction.options.getString('query'), insert = interaction.options.getBoolean('insert');
		let tracks = [], msg = '', extras = [];
		if (interaction.client.music.spotify.isSpotifyUrl(query)) {
			if (!features.spotify.enabled || !features.spotify.client_id || !features.spotify.client_secret) return interaction.replyHandler.locale('CMD.PLAY.RESPONSE.DISABLED.SPOTIFY', { type: 'error' });
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
					await interaction.replyHandler.locale('CMD.PLAY.RESPONSE.NO_RESULTS.SPOTIFY', { type: 'error' });
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
					return interaction.replyHandler.locale('CMD.PLAY.RESPONSE.NO_RESULTS.DEFAULT', { type: 'error' });
				case 'LOAD_FAILED':
					return interaction.replyHandler.locale('CMD.PLAY.RESPONSE.LOAD_FAILED', { type: 'error' });
				default:
					return interaction.replyHandler.locale('DISCORD.GENERIC_ERROR', { type: 'error' });
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
				if (interaction.guild) timedOut ? await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT', { type: 'error' }) : await interaction.replyHandler.locale('DISCORD.INTERACTION.CANCELED', { args: [interaction.user.id] });
				return player.handler.disconnect();
			}
		}

		const firstPosition = insert ? 1 : player.queue.tracks.length + 1;
		const endPosition = firstPosition + tracks.length - 1;

		player.queue.add(tracks, { requester: interaction.user.id, next: insert });

		const started = player.playing || player.paused;
		await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(await getGuildLocale(interaction.guildId, msg, ...extras))
				.setFooter({ text: started ? `${await getGuildLocale(interaction.guildId, 'MISC.POSITION')}: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : null }),
			{ type: 'success', ephemeral: true },
		);
		if (!started) await player.queue.start();
		if (features.web.enabled) {
			io.to(`guild:${interaction.guildId}`).emit('queueUpdate', player.queue.tracks.map(track => {
				track.requesterTag = bot.users.cache.get(track.requester)?.tag;
				return track;
			}));
		}
	},
};
