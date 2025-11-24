import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString, type LocaleKey } from '#src/lib/locales';
import {
    acceptableSources,
    Check,
    getTrackMarkdownLocaleString,
    type QuaverChannels,
    type QuaverSong,
    queryOverrides,
    settings,
} from '#src/lib/util';
import {
    ChannelType,
    ContainerBuilder,
    GuildMember,
    PermissionsBitField,
    type SlashCommandBooleanOption,
    SlashCommandBuilder,
    type SlashCommandStringOption,
    TextDisplayBuilder,
} from 'discord.js';
import { LavalinkWSClientState } from 'lavalink-ws-client';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('play')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.PLAY.DESCRIPTION',
                ),
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
    )
    .setChecks([Check.GuildOnly, Check.InVoice, Check.InSessionVoice])
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        if (
            ![
                ChannelType.GuildText,
                ChannelType.GuildVoice,
                ChannelType.GuildStageVoice,
            ].includes(interaction.channel.type)
        ) {
            await interaction.replyHandler.reply(
                guild.locale('DISCORD.CHANNEL_UNSUPPORTED'),
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
            await interaction.replyHandler.reply(
                guild.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        if (
            interaction.member.voice.channel.type ===
                ChannelType.GuildStageVoice &&
            !permissions.has(PermissionsBitField.StageModerator)
        ) {
            await interaction.replyHandler.reply(
                guild.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.STAGE'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        let me = await interaction.guild.members.fetchMe();
        if (me.isCommunicationDisabled()) {
            await interaction.replyHandler.reply(
                guild.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        if (interaction.client.music.ws.state !== LavalinkWSClientState.Ready) {
            await interaction.replyHandler.reply(
                guild.locale('MUSIC.NOT_READY'),
                {
                    type: MessageOptionsBuilderType.Error,
                },
            );
            return;
        }
        await interaction.deferReply();
        const query = interaction.options.getString('query');
        const insert = interaction.options.getBoolean('insert');
        let tracks: QuaverSong[] = [],
            msg = '',
            extras = [];
        let searchQuery;
        if (queryOverrides.some((q): boolean => query.startsWith(q))) {
            searchQuery = query;
        } else {
            const source =
                (await guild.settings.get<string>('source')) ??
                Object.keys(acceptableSources)[0];
            searchQuery = `${acceptableSources[source]}${query}`;
        }
        const result =
            await interaction.client.music.api.loadTracks(searchQuery);
        switch (result.loadType) {
            case 'playlist':
                tracks = [
                    ...result.data.tracks.map((t: QuaverSong): QuaverSong => {
                        t.requesterId = interaction.user.id;
                        t.id = crypto.randomUUID();
                        return t;
                    }),
                ];
                msg = insert
                    ? 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.INSERTED'
                    : 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.DEFAULT';
                extras = [
                    tracks.length.toString(),
                    result.data.info.name === query
                        ? result.data.info.name
                        : `[${result.data.info.name}](${query})`,
                ];
                break;
            case 'track':
            case 'search': {
                const track: QuaverSong =
                    result.loadType === 'search' ? result.data[0] : result.data;
                track.requesterId = interaction.user.id;
                track.id = crypto.randomUUID();
                tracks = [track];
                msg = insert
                    ? 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.INSERTED'
                    : 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT';
                extras = [getTrackMarkdownLocaleString(track)];
                break;
            }
            case 'empty':
                await interaction.replyHandler.reply(
                    guild.locale('CMD.PLAY.RESPONSE.NO_RESULTS'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case 'error':
                await interaction.replyHandler.reply(
                    guild.locale('CMD.PLAY.RESPONSE.LOAD_FAILED'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            default:
                await interaction.replyHandler.reply(
                    guild.locale('DISCORD.GENERIC_ERROR'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
        }
        let player = await guild.getPlayer();
        if (!player?.voice.connected) {
            player = interaction.client.music.players.create(interaction.guild);
            player.queue.channel = interaction.channel as QuaverChannels;
            player.voice.connect(interaction.member.voice.channelId, {
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
                        await interaction.replyHandler.reply(
                            guild.locale(
                                'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.TIMED_OUT',
                            ),
                            { type: MessageOptionsBuilderType.Error },
                        );
                    } else {
                        await interaction.replyHandler.reply(
                            guild.locale(
                                'DISCORD.INTERACTION.CANCELED',
                                interaction.user.id,
                            ),
                        );
                    }
                }
                await player.disconnect();
                return;
            }
            const smartQueue = await guild.settings.get<boolean>('smartqueue');
            if (smartQueue) {
                await player.setAlternate(true);
            }
        }
        const position = await player.addTracksToQueue(tracks, insert);
        await interaction.replyHandler.reply(
            new ContainerBuilder().addTextDisplayComponents(
                guild.builders.textDisplayLocale(msg as LocaleKey, ...extras),
                ...(position !== '0'
                    ? [
                          new TextDisplayBuilder().setContent(
                              `-# ${guild.locale('MISC.POSITION')}: ${position}`,
                          ),
                      ]
                    : []),
            ),
            { type: MessageOptionsBuilderType.Success },
        );
        guild.sendWebUpdate(
            'queueUpdate',
            player.queue.tracks.map((track: QuaverSong): QuaverSong => {
                const user = interaction.client.users.cache.get(
                    track.requesterId,
                );
                track.requesterTag = user?.tag;
                track.requesterAvatar = user?.avatar;
                return track;
            }),
        );
    });
