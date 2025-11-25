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
    ContainerBuilder,
    type GuildMember,
    type SlashCommandBooleanOption,
    SlashCommandBuilder,
    type SlashCommandStringOption,
    TextDisplayBuilder,
} from 'discord.js';

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
        const compatible = await guild.checkPlayerCompatibility({
            member: interaction.member as GuildMember,
            textChannel: interaction.channel,
            replyHandler: interaction.replyHandler,
        });
        if (!compatible) return;
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
        const player = await guild.getPlayer({
            textChannel: interaction.channel as QuaverChannels,
            voiceChannelId: (interaction.member as GuildMember).voice.channelId,
            replyHandler: interaction.replyHandler,
        });
        if (!player) return;
        const position = await player.addTracksToQueue(
            tracks,
            interaction.user.id,
            insert,
        );
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
