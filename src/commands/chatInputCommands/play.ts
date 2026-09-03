import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString, type LocaleKey } from '#src/lib/locales';
import { updateHandler } from '#src/lib/state';
import {
    acceptableSources,
    Check,
    getTrackMarkdownLocaleString,
    type QuaverChannels,
    type QuaverSong,
    searchTracks,
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
        if (updateHandler.restartInProgress) {
            await interaction.replyHandler.reply(
                guild.locale('MUSIC.PLAYER.RESTARTING.ACTION_BLOCKED'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        await interaction.deferReply();
        const query = interaction.options.getString('query');
        const insert = interaction.options.getBoolean('insert');
        let tracks: QuaverSong[] = [],
            msg = '',
            extras = [];
        const result = await searchTracks(
            interaction.client,
            guild,
            query,
        );
        switch (result.loadType) {
            case 'playlist': {
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
                const showArtist = (await guild.settings.get<boolean>('showartist')) ?? true;
                // Check if all available source emojis are configured
                const availableSources = Object.keys(acceptableSources);
                const allSourceEmojisConfigured = availableSources.every(
                    (source): boolean => !!settings.emojis[source as keyof typeof settings.emojis]
                );
                const showSourceLabels = (await guild.settings.get<boolean>('showsourcelabels')) ?? allSourceEmojisConfigured;

                // Get source emoji from first track in playlist
                const sourceEmoji = showSourceLabels && tracks.length > 0 && tracks[0].info.sourceName
                    ? settings.emojis?.[tracks[0].info.sourceName as keyof typeof settings.emojis] || ''
                    : '';
                const sourcePrefix = sourceEmoji ? `${sourceEmoji} ` : '';

                let playlistDisplay: string;
                if (result.data.info.name === query) {
                    playlistDisplay = showArtist && result.data.pluginInfo?.author
                        ? `${sourcePrefix}${result.data.pluginInfo.author} - ${result.data.info.name}`
                        : `${sourcePrefix}${result.data.info.name}`;
                } else {
                    const displayName = showArtist && result.data.pluginInfo?.author
                        ? `${result.data.pluginInfo.author} - ${result.data.info.name}`
                        : result.data.info.name;
                    playlistDisplay = `${sourcePrefix}[${displayName}](${query})`;
                }
                extras = [
                    tracks.length.toString(),
                    playlistDisplay,
                ];
                break;
            }
            case 'track':
            case 'search': {
                const track: QuaverSong =
                    result.loadType === 'search' ? result.data[0] : result.data;
                if (!track) {
                    await interaction.replyHandler.reply(
                        guild.locale('CMD.PLAY.RESPONSE.NO_RESULTS'),
                        { type: MessageOptionsBuilderType.Error },
                    );
                    return;
                }
                track.requesterId = interaction.user.id;
                track.id = crypto.randomUUID();
                tracks = [track];
                msg = insert
                    ? 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.INSERTED'
                    : 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT';
                const showArtist = (await guild.settings.get<boolean>('showartist')) ?? true;
                // Check if all available source emojis are configured
                const availableSources = Object.keys(acceptableSources);
                const allSourceEmojisConfigured = availableSources.every(
                    (source): boolean => !!settings.emojis[source as keyof typeof settings.emojis]
                );
                const showSourceLabels = (await guild.settings.get<boolean>('showsourcelabels')) ?? allSourceEmojisConfigured;

                const sourceEmoji = showSourceLabels && track.info.sourceName
                    ? settings.emojis?.[track.info.sourceName as keyof typeof settings.emojis] || ''
                    : '';
                const sourcePrefix = sourceEmoji ? `${sourceEmoji} ` : '';

                extras = [`${sourcePrefix}${getTrackMarkdownLocaleString(track, showArtist)}`];
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
        guild.sendWebUpdate('queueUpdate', player.decorateQueue());
    });
