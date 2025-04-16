import PlayerHandler from '#src/lib/PlayerHandler.js';
import type {
    QuaverChannels,
    QuaverInteraction,
    QuaverPlayer,
    QuaverSong,
} from '#src/lib/util/common.d.js';
import { data, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import {
    acceptableSources,
    Check,
    queryOverrides,
} from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import type {
    ChatInputCommandInteraction,
    SlashCommandBooleanOption,
    SlashCommandStringOption,
} from 'discord.js';
import {
    ChannelType,
    EmbedBuilder,
    GuildMember,
    PermissionsBitField,
    SlashCommandBuilder,
} from 'discord.js';
import { LavalinkWSClientState } from 'lavalink-ws-client';

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
    checks: [Check.GuildOnly, Check.InVoice, Check.InSessionVoice],
    permissions: {
        user: [],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
        const { bot, io } = await import('#src/main.js');
        if (
            ![
                ChannelType.GuildText,
                ChannelType.GuildVoice,
                ChannelType.GuildStageVoice,
            ].includes(interaction.channel.type)
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
        if (interaction.client.music.ws.state !== LavalinkWSClientState.Ready) {
            await interaction.replyHandler.locale('MUSIC.NOT_READY', {
                type: MessageOptionsBuilderType.Error,
            });
            return;
        }
        await interaction.deferReply();
        const query = interaction.options.getString('query');
        const insert = interaction.options.getBoolean('insert');
        let tracks: QuaverSong[] = [],
            msg = '',
            extras = [];
        const source =
            (await data.guild.get<string>(
                interaction.guildId,
                'settings.source',
            )) ?? Object.keys(acceptableSources)[0];
        const preQuery = acceptableSources[source];
        const result = await interaction.client.music.api.loadTracks(
            queryOverrides.some((q): boolean => query.startsWith(q))
                ? query
                : `${preQuery}${query}`,
        );
        switch (result.loadType) {
            case 'playlist':
                tracks = [...result.data.tracks] as unknown as QuaverSong[];
                msg = insert
                    ? 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.INSERTED'
                    : 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.DEFAULT';
                extras = [
                    tracks.length.toString(),
                    result.data.info.name,
                    query,
                ];
                break;
            case 'track':
            case 'search': {
                const track =
                    result.loadType === 'search' ? result.data[0] : result.data;
                tracks = [track];
                msg = insert
                    ? 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.INSERTED'
                    : 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT';
                extras = [track.info.title, track.info.uri];
                break;
            }
            case 'empty':
                await interaction.replyHandler.locale(
                    'CMD.PLAY.RESPONSE.NO_RESULTS',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case 'error':
                await interaction.replyHandler.locale(
                    'CMD.PLAY.RESPONSE.LOAD_FAILED',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            default:
                await interaction.replyHandler.locale('DISCORD.GENERIC_ERROR', {
                    type: MessageOptionsBuilderType.Error,
                });
                return;
        }
        let player = (await interaction.client.music.players.fetch(
            interaction.guildId,
        )) as QuaverPlayer;
        if (!player?.voice.connected) {
            player = interaction.client.music.players.create(
                interaction.guildId,
            ) as QuaverPlayer;
            player.handler = new PlayerHandler(interaction.client, player);
            player.queue.channel = interaction.channel as QuaverChannels;
            await player.voice.connect(interaction.member.voice.channelId, {
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
                    if (timedOut) {
                        await interaction.replyHandler.locale(
                            'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT',
                            { type: MessageOptionsBuilderType.Error },
                        );
                    } else {
                        await interaction.replyHandler.locale(
                            'DISCORD.INTERACTION.CANCELED',
                            { vars: [interaction.user.id] },
                        );
                    }
                }
                await player.handler.disconnect();
                return;
            }
        }
        const firstPosition = insert ? 1 : player.queue.tracks.length + 1;
        const endPosition = firstPosition + tracks.length - 1;
        player.queue.add(tracks, {
            requester: interaction.user.id,
            next: insert,
        });
        const started = player.playing || player.paused;
        const smartQueue = await data.guild.get<boolean>(
            interaction.guildId,
            'settings.smartqueue',
        );
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
                    text:
                        started && !smartQueue
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
        if (smartQueue) await player.handler.sort();
        if (settings.features.web.enabled) {
            io.to(`guild:${interaction.guildId}`).emit(
                'queueUpdate',
                player.queue.tracks.map((track: QuaverSong): QuaverSong => {
                    const user = bot.users.cache.get(track.requesterId);
                    track.requesterTag = user?.tag;
                    track.requesterAvatar = user?.avatar;
                    return track;
                }),
            );
        }
    },
};
