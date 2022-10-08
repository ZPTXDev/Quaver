import { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder, escapeMarkdown, SlashCommandStringOption, SlashCommandBooleanOption, ChatInputCommandInteraction, Client, GuildMember, TextChannel, VoiceChannel } from 'discord.js';
import { SpotifyItemType } from '@lavaclient/spotify';
import { defaultLocaleCode, features } from '#src/settings.js';
import { checks } from '#src/lib/util/constants.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import PlayerHandler from '#src/lib/PlayerHandler.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import { Node, Player } from 'lavaclient';
import { Queue, Song } from '@lavaclient/queue';

export default {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription(getLocaleString(defaultLocaleCode, 'CMD.PLAY.DESCRIPTION'))
		.addStringOption((option): SlashCommandStringOption =>
			option
				.setName('query')
				.setDescription(getLocaleString(defaultLocaleCode, 'CMD.PLAY.OPTION.QUERY'))
				.setRequired(true)
				.setAutocomplete(true))
		.addBooleanOption((option): SlashCommandBooleanOption =>
			option
				.setName('insert')
				.setDescription(getLocaleString(defaultLocaleCode, 'CMD.PLAY.OPTION.INSERT'))),
	checks: [checks.GUILD_ONLY, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const { bot, io } = await import('#src/main.js');
		if (![ChannelType.GuildText, ChannelType.GuildVoice].includes(interaction.channel.type)) {
			await interaction.replyHandler.locale('DISCORD.CHANNEL_UNSUPPORTED', { type: 'error' });
			return;
		}
		// check for connect, speak permission for channel
		if (!(interaction.member instanceof GuildMember)) return;
		const permissions = interaction.member.voice.channel.permissionsFor(interaction.client.user.id);
		if (!permissions.has(new PermissionsBitField([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]))) {
			await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC', { type: 'error' });
			return;
		}
		if (interaction.member.voice.channel.type === ChannelType.GuildStageVoice && !permissions.has(PermissionsBitField.StageModerator)) {
			await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.STAGE', { type: 'error' });
			return;
		}
		if (interaction.guild.members.me.isCommunicationDisabled()) {
			await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT', { type: 'error' });
			return;
		}
		await interaction.deferReply();
		const query = interaction.options.getString('query'), insert = interaction.options.getBoolean('insert');
		let tracks = [], msg = '', extras = [];
		if (interaction.client.music.spotify.isSpotifyUrl(query.replace('embed/', ''))) {
			if (!features.spotify.enabled || !features.spotify.client_id || !features.spotify.client_secret) {
				await interaction.replyHandler.locale('CMD.PLAY.RESPONSE.DISABLED.SPOTIFY', { type: 'error' });
				return;
			}
			const item = await interaction.client.music.spotify.load(query.replace('embed/', ''));
			switch (item?.type) {
				case SpotifyItemType.Track: {
					const track = await item.resolveYoutubeTrack();
					tracks = [track];
					msg = insert ? 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.INSERTED' : 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT';
					extras = [escapeMarkdown(item.name), query];
					break;
				}
				case SpotifyItemType.Album:
				case SpotifyItemType.Playlist:
				case SpotifyItemType.Artist:
					tracks = await item.resolveYoutubeTracks();
					msg = insert ? 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.INSERTED' : 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.DEFAULT';
					extras = [tracks.length.toString(), escapeMarkdown(item.name), query];
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
					extras = [tracks.length.toString(), escapeMarkdown(results.playlistInfo.name), query];
					break;
				case 'TRACK_LOADED':
				case 'SEARCH_RESULT': {
					const [track] = results.tracks;
					tracks = [track];
					msg = insert ? 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.INSERTED' : 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT';
					extras = [escapeMarkdown(track.info.title), track.info.uri];
					break;
				}
				case 'NO_MATCHES':
					await interaction.replyHandler.locale('CMD.PLAY.RESPONSE.NO_RESULTS.DEFAULT', { type: 'error' });
					return;
				case 'LOAD_FAILED':
					await interaction.replyHandler.locale('CMD.PLAY.RESPONSE.LOAD_FAILED', { type: 'error' });
					return;
				default:
					await interaction.replyHandler.locale('DISCORD.GENERIC_ERROR', { type: 'error' });
					return;
			}
		}
		let player: Player<Node> & { handler?: PlayerHandler, queue?: Queue & { channel?: TextChannel | VoiceChannel } } = <Player<Node> & { handler: PlayerHandler }> interaction.client.music.players.get(interaction.guildId);
		if (!player?.connected) {
			player = interaction.client.music.createPlayer(interaction.guildId);
			player.handler = new PlayerHandler(interaction.client, player);
			player.queue.channel = <TextChannel | VoiceChannel> interaction.channel;
			await player.connect(interaction.member.voice.channelId, { deafened: true });
			// Ensure that Quaver destroys the player if the user leaves the channel while Quaver is queuing tracks
			// Ensure that Quaver destroys the player if Quaver gets timed out by the user while Quaver is queuing tracks
			// Ensure that Quaver destroys the player if Quaver gets kicked or banned by the user while Quaver is queuing tracks
			const me = await interaction.guild?.members.fetchMe();
			const timedOut = me.isCommunicationDisabled();
			if (!interaction.member.voice.channelId || timedOut || !interaction.guild) {
				if (interaction.guild) timedOut ? await interaction.replyHandler.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT', { type: 'error' }) : await interaction.replyHandler.locale('DISCORD.INTERACTION.CANCELED', { vars: [interaction.user.id] });
				return player.handler.disconnect();
			}
		}
		const firstPosition = insert ? 1 : player.queue.tracks.length + 1;
		const endPosition = firstPosition + tracks.length - 1;
		player.queue.add(tracks, { requester: interaction.user.id, next: insert });
		const started = player.playing || player.paused;
		await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(await getGuildLocaleString(interaction.guildId, msg, ...extras))
				.setFooter({ text: started ? `${await getGuildLocaleString(interaction.guildId, 'MISC.POSITION')}: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : null }),
			{ type: 'success', ephemeral: true },
		);
		if (!started) await player.queue.start();
		if (features.web.enabled) {
			io.to(`guild:${interaction.guildId}`).emit('queueUpdate', player.queue.tracks.map((track: Song & { requesterTag: string }): Song & { requesterTag: string } => {
				track.requesterTag = bot.users.cache.get(track.requester)?.tag;
				return track;
			}));
		}
	},
};
