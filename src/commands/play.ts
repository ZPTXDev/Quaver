import PlayerHandler from '#src/lib/PlayerHandler.js';
import type {
    QuaverChannels,
    QuaverInteraction,
    QuaverPlayer,
    QuaverSong,
} from '#src/lib/util/common.d.js';
import { MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import type { Item } from '@lavaclient/spotify';
import { SpotifyItemType } from '@lavaclient/spotify';
import type {
    ChatInputCommandInteraction,
    SlashCommandBooleanOption,
    SlashCommandStringOption,
} from 'discord.js';
import {
    ChannelType,
    EmbedBuilder,
    escapeMarkdown,
    GuildMember,
    PermissionsBitField,
    SlashCommandBuilder,
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription(
            getLocaleString(settings.defaultLocaleCode, 'CMD.PLAY.DESCRIPTION'),
        )
        .addStringOption(
            (option): SlashCommandStringOption =>
                option
                    .setName('query')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.PLAY.OPTION.QUERY',
                        ),
                    )
                    .setRequired(true)
                    .setAutocomplete(true),
        )
        .addBooleanOption(
            (option): SlashCommandBooleanOption =>
                option
                    .setName('insert')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.PLAY.OPTION.INSERT',
                        ),
                    ),
        ),
    checks: [checks.GUILD_ONLY, checks.IN_VOICE, checks.IN_SESSION_VOICE],
    permissions: {
        user: [],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
        const { bot, io } = await import('#src/main.js');
        if (
            ![ChannelType.GuildText, ChannelType.GuildVoice].includes(
                interaction.channel.type,
            )
        ) {
            await interaction.replyHandler.locale(
                'DISCORD.CHANNEL_UNSUPPORTED',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        // check for connect, speak permission for channel
        if (!(interaction.member instanceof GuildMember)) return;
        const permissions = interaction.member.voice.channel.permissionsFor(
            interaction.client.user.id,
        );
        if (
            !permissions.has(
                new PermissionsBitField([
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.Connect,
                    PermissionsBitField.Flags.Speak,
                ]),
            )
        ) {
            await interaction.replyHandler.locale(
                'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        if (
            interaction.member.voice.channel.type ===
                ChannelType.GuildStageVoice &&
            !permissions.has(PermissionsBitField.StageModerator)
        ) {
            await interaction.replyHandler.locale(
                'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.STAGE',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        let me = await interaction.guild.members.fetchMe();
        if (me.isCommunicationDisabled()) {
            await interaction.replyHandler.locale(
                'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        await interaction.deferReply();
        let query = interaction.options.getString('query');
        const insert = interaction.options.getBoolean('insert');
        let tracks = [],
            msg = '',
            extras = [];
        if (
            interaction.client.music.spotify.isSpotifyUrl(
                query.replace('embed/', ''),
            )
        ) {
            query = query.replace('embed/', '');
            if (
                !settings.features.spotify.enabled ||
                !settings.features.spotify.client_id ||
                !settings.features.spotify.client_secret
            ) {
                await interaction.replyHandler.locale(
                    'CMD.PLAY.RESPONSE.DISABLED.SPOTIFY',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
            let item: Item;
            try {
                item = await interaction.client.music.spotify.load(query);
            } catch (err) {
                await interaction.replyHandler.locale(
                    'CMD.PLAY.RESPONSE.NO_RESULTS.SPOTIFY',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
            switch (item?.type) {
                case SpotifyItemType.Track: {
                    const track = await item.resolveYoutubeTrack();
                    tracks = [track];
                    msg = insert
                        ? 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.INSERTED'
                        : 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT';
                    extras = [escapeMarkdown(item.name), query];
                    break;
                }
                case SpotifyItemType.Album:
                case SpotifyItemType.Playlist:
                case SpotifyItemType.Artist:
                    if (
                        (item.type === SpotifyItemType.Artist
                            ? item.topTracks
                            : item.tracks
                        ).length > 500
                    ) {
                        await interaction.replyHandler.locale(
                            'CMD.PLAY.RESPONSE.LIMIT_EXCEEDED.SPOTIFY',
                            { type: MessageOptionsBuilderType.Error },
                        );
                        return;
                    }
                    tracks = await item.resolveYoutubeTracks();
                    msg = insert
                        ? 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.INSERTED'
                        : 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.DEFAULT';
                    extras = [
                        tracks.length.toString(),
                        escapeMarkdown(item.name),
                        query,
                    ];
                    break;
                default:
                    await interaction.replyHandler.locale(
                        'CMD.PLAY.RESPONSE.NO_RESULTS.SPOTIFY',
                        { type: MessageOptionsBuilderType.Error },
                    );
                    return;
            }
        } else {
            const results = await interaction.client.music.rest.loadTracks(
                /^https?:\/\//.test(query) ? query : `ytsearch:${query}`,
            );
            switch (results.loadType) {
                case 'PLAYLIST_LOADED':
                    tracks = results.tracks;
                    msg = insert
                        ? 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.INSERTED'
                        : 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.DEFAULT';
                    extras = [
                        tracks.length.toString(),
                        escapeMarkdown(results.playlistInfo.name),
                        query,
                    ];
                    break;
                case 'TRACK_LOADED':
                case 'SEARCH_RESULT': {
                    const [track] = results.tracks;
                    tracks = [track];
                    msg = insert
                        ? 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.INSERTED'
                        : 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT';
                    extras = [escapeMarkdown(track.info.title), track.info.uri];
                    break;
                }
                case 'NO_MATCHES':
                    await interaction.replyHandler.locale(
                        'CMD.PLAY.RESPONSE.NO_RESULTS.DEFAULT',
                        { type: MessageOptionsBuilderType.Error },
                    );
                    return;
                case 'LOAD_FAILED':
                    await interaction.replyHandler.locale(
                        'CMD.PLAY.RESPONSE.LOAD_FAILED',
                        { type: MessageOptionsBuilderType.Error },
                    );
                    return;
                default:
                    await interaction.replyHandler.locale(
                        'DISCORD.GENERIC_ERROR',
                        { type: MessageOptionsBuilderType.Error },
                    );
                    return;
            }
        }
        let player = interaction.client.music.players.get(
            interaction.guildId,
        ) as QuaverPlayer;
        if (!player?.connected) {
            player = interaction.client.music.createPlayer(
                interaction.guildId,
            ) as QuaverPlayer;
            player.handler = new PlayerHandler(interaction.client, player);
            player.queue.channel = interaction.channel as QuaverChannels;
            await player.connect(interaction.member.voice.channelId, {
                deafened: true,
            });
            // Ensure that Quaver destroys the player if the user leaves the channel while Quaver is queuing tracks
            // Ensure that Quaver destroys the player if Quaver gets timed out by the user while Quaver is queuing tracks
            // Ensure that Quaver destroys the player if Quaver gets kicked or banned by the user while Quaver is queuing tracks
            me = await interaction.guild?.members.fetchMe();
            const timedOut = me.isCommunicationDisabled();
            if (
                !interaction.member.voice.channelId ||
                timedOut ||
                !interaction.guild
            ) {
                if (interaction.guild) {
                    timedOut
                        ? await interaction.replyHandler.locale(
                              'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT',
                              { type: MessageOptionsBuilderType.Error },
                          )
                        : await interaction.replyHandler.locale(
                              'DISCORD.INTERACTION.CANCELED',
                              { vars: [interaction.user.id] },
                          );
                }
                return player.handler.disconnect();
            }
        }
        const firstPosition = insert ? 1 : player.queue.tracks.length + 1;
        const endPosition = firstPosition + tracks.length - 1;
        player.queue.add(tracks, {
            requester: interaction.user.id,
            next: insert,
        });
        const started = player.playing || player.paused;
        await interaction.replyHandler.reply(
            new EmbedBuilder()
                .setDescription(
                    await getGuildLocaleString(
                        interaction.guildId,
                        msg,
                        ...extras,
                    ),
                )
                .setFooter({
                    text: started
                        ? `${await getGuildLocaleString(
                              interaction.guildId,
                              'MISC.POSITION',
                          )}: ${firstPosition}${
                              endPosition !== firstPosition
                                  ? ` - ${endPosition}`
                                  : ''
                          }`
                        : null,
                }),
            { type: MessageOptionsBuilderType.Success, ephemeral: true },
        );
        if (!started) await player.queue.start();
        if (settings.features.web.enabled) {
            io.to(`guild:${interaction.guildId}`).emit(
                'queueUpdate',
                player.queue.tracks.map((track: QuaverSong): QuaverSong => {
                    track.requesterTag = bot.users.cache.get(
                        track.requester,
                    )?.tag;
                    return track;
                }),
            );
        }
    },
};
