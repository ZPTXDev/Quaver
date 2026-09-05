import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { type Initialized, QuaverGuild } from '#src/lib/guild';
import type { QuaverInteraction } from '#src/lib/interactions';
import { getLocaleString, type LocaleKey } from '#src/lib/locales';
import { logger } from '#src/lib/logger';
import { searchState, updateHandler } from '#src/lib/state';
import type { QuaverChannels, QuaverSong } from '#src/lib/util';
import {
    buildMessageOptions,
    Check,
    getTrackMarkdownLocaleString,
    searchTracks,
    settings,
    acceptableSources,
    splitMultipleLinks,
} from '#src/lib/util';
import type { Song } from '@lavaclient/plugin-queue';
import { msToTime, msToTimeString, paginate } from '@zptxdev/zptx-lib';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    type ChatInputCommandInteraction,
    ContainerBuilder,
    type GuildMember,
    InteractionCallbackResponse,
    Message,
    type SelectMenuComponentOptionData,
    SeparatorBuilder,
    SlashCommandBuilder,
    type SlashCommandStringOption,
    type StringSelectMenuBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import type { LavalinkAPI } from 'lavalink-api-client';
import { LavalinkWSClientState } from 'lavalink-ws-client';

// credit: https://github.com/lavaclient/djs-v13-example/blob/main/src/commands/Play.ts
export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('search')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.SEARCH.DESCRIPTION',
                ),
            )
            .addStringOption(
                (option): SlashCommandStringOption =>
                    option
                        .setName('query')
                        .setDescription(
                            getLocaleString(
                                settings.defaultLocaleCode,
                                'CMD.SEARCH.OPTION.QUERY',
                            ),
                        )
                        .setRequired(true)
                        .setAutocomplete(true),
            ),
    )
    .setChecks([Check.GuildOnly])
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        if (updateHandler.restartInProgress) {
            await interaction.replyHandler.reply(
                guild.locale('MUSIC.PLAYER.RESTARTING.ACTION_BLOCKED'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
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
        if (interaction.client.music.ws.state !== LavalinkWSClientState.Ready) {
            await interaction.replyHandler.reply(
                guild.locale('MUSIC.NOT_READY'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        await interaction.deferReply();
        const query = interaction.options.getString('query');

        // Check for multiple links
        const queries = splitMultipleLinks(query);

        if (queries.length > 1) {
            // Handle multiple links
            const allTracks: QuaverSong[] = [];
            let failedCount = 0;

            for (const singleQuery of queries) {
                const result = await searchTracks(interaction.client, guild, singleQuery);

                switch (result.loadType) {
                    case 'playlist': {
                        const playlistTracks = result.data.tracks.map((t: QuaverSong): QuaverSong => {
                            t.requesterId = interaction.user.id;
                            t.id = crypto.randomUUID();
                            return t;
                        });
                        allTracks.push(...playlistTracks);
                        break;
                    }
                    case 'track': {
                        const track: QuaverSong = result.data;
                        track.requesterId = interaction.user.id;
                        track.id = crypto.randomUUID();
                        allTracks.push(track);
                        break;
                    }
                    case 'search': {
                        const track: QuaverSong = result.data[0];
                        if (track) {
                            track.requesterId = interaction.user.id;
                            track.id = crypto.randomUUID();
                            allTracks.push(track);
                        } else {
                            failedCount++;
                        }
                        break;
                    }
                    default:
                        failedCount++;
                        break;
                }
            }

            if (allTracks.length === 0) {
                await interaction.replyHandler.reply(
                    guild.locale('CMD.PLAY.RESPONSE.NO_RESULTS'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }

            await handleMultipleLinksAdd(interaction, guild, allTracks, queries.length);
            return;
        }

        // Handle single query (existing logic)
        const result = await searchTracks(interaction.client, guild, query);
        switch (result.loadType) {
            case 'playlist':
            case 'track': {
                await handleImmediateAdd(interaction, guild, result, query);
                return;
            }
            case 'search': {
                const tracks = result.data.map((t: QuaverSong): QuaverSong => {
                    t.requesterId = interaction.user.id;
                    t.id = crypto.randomUUID();
                    return t;
                });
                if (tracks.length === 0) {
                    await interaction.replyHandler.reply(
                        guild.locale('CMD.PLAY.RESPONSE.NO_RESULTS'),
                        { type: MessageOptionsBuilderType.Error },
                    );
                    return;
                }
                await renderSearchResults(interaction, guild, tracks);
                return;
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
    });

async function handleMultipleLinksAdd(
    interaction: QuaverInteraction<ChatInputCommandInteraction>,
    guild: QuaverGuild<Initialized>,
    tracks: QuaverSong[],
    linkCount: number,
): Promise<void> {
    const compatible = await guild.checkPlayerCompatibility({
        member: interaction.member as GuildMember,
        textChannel: interaction.channel,
        replyHandler: interaction.replyHandler,
    });
    if (!compatible) return;
    const player = await guild.getPlayer({
        textChannel: interaction.channel as QuaverChannels,
        voiceChannelId: (interaction.member as GuildMember).voice.channelId,
        replyHandler: interaction.replyHandler,
    });
    if (!player) return;
    const position = await player.addTracksToQueue(tracks, interaction.user.id);
    await interaction.replyHandler.reply(
        new ContainerBuilder().addTextDisplayComponents(
            guild.builders.textDisplayLocale(
                'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.DEFAULT' as LocaleKey,
                tracks.length.toString(),
                guild.locale('MISC.X_LINKS', linkCount.toString()),
            ),
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
}

async function handleImmediateAdd(
    interaction: QuaverInteraction<ChatInputCommandInteraction>,
    guild: QuaverGuild<Initialized>,
    result: Extract<
        Awaited<ReturnType<LavalinkAPI['loadTracks']>>,
        { loadType: 'track' | 'playlist' }
    >,
    query: string,
): Promise<void> {
    const showArtist = (await guild.settings.get<boolean>('showartist')) ?? true;
    // Check if all available source emojis are configured
    const availableSources = Object.keys(acceptableSources);
    const allSourceEmojisConfigured = availableSources.every(
        (source): boolean => !!settings.emojis[source as keyof typeof settings.emojis]
    );
    const showSourceLabels = (await guild.settings.get<boolean>('showsourcelabels')) ?? allSourceEmojisConfigured;
    const tracks =
        result.loadType === 'track'
            ? [
                  {
                      ...(result.data as QuaverSong),
                      requesterId: interaction.user.id,
                      id: crypto.randomUUID(),
                  },
              ]
            : result.data.tracks.map(
                  (t: QuaverSong): QuaverSong => ({
                      ...t,
                      requesterId: interaction.user.id,
                      id: crypto.randomUUID(),
                  }),
              );
    const msg =
        result.loadType === 'track'
            ? 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT'
            : 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.DEFAULT';
    let extras: string[];
    if (result.loadType === 'track') {
        const sourceEmoji = showSourceLabels && tracks[0].info.sourceName
            ? settings.emojis?.[tracks[0].info.sourceName as keyof typeof settings.emojis] || ''
            : '';
        const sourcePrefix = sourceEmoji ? `${sourceEmoji} ` : '';
        extras = [`${sourcePrefix}${getTrackMarkdownLocaleString(tracks[0], showArtist)}`];
    } else {
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
        extras = [tracks.length.toString(), playlistDisplay];
    }
    const compatible = await guild.checkPlayerCompatibility({
        member: interaction.member as GuildMember,
        textChannel: interaction.channel,
        replyHandler: interaction.replyHandler,
    });
    if (!compatible) return;
    const player = await guild.getPlayer({
        textChannel: interaction.channel as QuaverChannels,
        voiceChannelId: (interaction.member as GuildMember).voice.channelId,
        replyHandler: interaction.replyHandler,
    });
    if (!player) return;
    const position = await player.addTracksToQueue(tracks, interaction.user.id);
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
}

async function renderSearchResults(
    interaction: QuaverInteraction<ChatInputCommandInteraction>,
    guild: QuaverGuild<Initialized>,
    tracks: QuaverSong[],
): Promise<void> {
    const showArtist = (await guild.settings.get<boolean>('showartist')) ?? true;
    // Check if all available source emojis are configured
    const availableSources = Object.keys(acceptableSources);
    const allSourceEmojisConfigured = availableSources.every(
        (source): boolean => !!settings.emojis[source as keyof typeof settings.emojis]
    );
    const showSourceLabels = (await guild.settings.get<boolean>('showsourcelabels')) ?? allSourceEmojisConfigured;
    const pages = paginate(tracks, 10);
    const response = await interaction.replyHandler.reply(
        new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    pages[0]
                        .map((track: Song, index): string => {
                            const duration = msToTime(track.info.length);
                            let durationString = track.info.isStream
                                ? '∞'
                                : msToTimeString(duration, true);
                            if (durationString === 'MORE_THAN_A_DAY') {
                                durationString = guild.locale(
                                    'MISC.MORE_THAN_A_DAY',
                                );
                            }
                            const sourceEmoji = showSourceLabels && track.info.sourceName
                                ? settings.emojis?.[track.info.sourceName as keyof typeof settings.emojis] || ''
                                : '';
                            const sourcePrefix = sourceEmoji ? `${sourceEmoji} ` : '';

                            const indexStr = `\`${(index + 1)
                                .toString()
                                .padStart(
                                    tracks.length.toString().length,
                                    ' ',
                                )}.\` `;
                            const durationStr = ` \`[${durationString}]\``;

                            // Calculate remaining characters for the line
                            const baseLength = indexStr.length + durationStr.length;
                            const maxTrackLength = 300 - baseLength - sourcePrefix.length;

                            // Build the link text (what goes inside the brackets)
                            let linkText: string;
                            if (track.info.title === track.info.uri) {
                                linkText = track.info.uri;
                            } else if (showArtist && track.info.author) {
                                linkText = `${track.info.author} - ${track.info.title}`;
                            } else {
                                linkText = track.info.title;
                            }

                            // Calculate max length for link text: account for markdown syntax
                            // Format will be: **[linkText](url)** or just url
                            // **url** = 4 chars, **[](url)** = 6 chars + url length
                            const markdownOverhead = track.info.title === track.info.uri
                                ? 4
                                : 6 + track.info.uri.length;
                            const maxLinkTextLength = maxTrackLength - markdownOverhead;

                            // Truncate link text if needed
                            if (linkText.length > maxLinkTextLength) {
                                const ellipsis = '…';
                                linkText = linkText.substring(0, maxLinkTextLength - ellipsis.length) + ellipsis;
                            }

                            // Build final markdown string
                            let trackStr: string;
                            if (track.info.title === track.info.uri) {
                                trackStr = `**${linkText}**`;
                            } else {
                                trackStr = `**[${linkText}](${track.info.uri})**`;
                            }

                            return `${indexStr}${sourcePrefix}${trackStr}${durationStr}`;
                        })
                        .join('\n'),
                ),
                guild.builders.textDisplayLocale(
                    'MISC.PAGE',
                    '1',
                    pages.length.toString(),
                ),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
                new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    guild.builders
                        .stringSelectMenuLocale('CMD.SEARCH.MISC.PICK')
                        .setCustomId('search')
                        .addOptions(
                            pages[0].map(
                                (
                                    track,
                                    index,
                                ): SelectMenuComponentOptionData => {
                                    let label = `${index + 1}. ${
                                        track.info.title
                                    }`;
                                    if (label.length >= 100) {
                                        label = `${label.substring(0, 99)}…`;
                                    }
                                    let description = track.info.author;
                                    if (description.length >= 100) {
                                        description = `${description.substring(
                                            0,
                                            99,
                                        )}…`;
                                    }
                                    return {
                                        label: label,
                                        description: description,
                                        value: track.id,
                                    };
                                },
                            ),
                        )
                        .setMinValues(0)
                        .setMaxValues(Math.min(pages[0].length, 25)),
                ),
            )
            .addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId('search:0')
                        .setEmoji(settings.emojis.left)
                        .setDisabled(true)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('search:2')
                        .setEmoji(settings.emojis.right)
                        .setDisabled(pages.length === 1)
                        .setStyle(ButtonStyle.Secondary),
                    guild.builders
                        .buttonLocale('MISC.ADD')
                        .setStyle(ButtonStyle.Success)
                        .setCustomId('search:add')
                        .setDisabled(true),
                    guild.builders
                        .buttonLocale('MISC.CANCEL')
                        .setStyle(ButtonStyle.Danger)
                        .setCustomId('cancel'),
                ),
            ),
        { withResponse: true },
    );
    if (
        !(
            response instanceof InteractionCallbackResponse ||
            response instanceof Message
        )
    ) {
        return;
    }
    const msg =
        response instanceof InteractionCallbackResponse
            ? response.resource.message
            : response;
    searchState[msg.id] = {
        pages,
        timeout: setTimeout(
            async (g, message): Promise<void> => {
                try {
                    await message.edit(
                        buildMessageOptions(
                            g.locale('DISCORD.INTERACTION.EXPIRED'),
                            { components: [] },
                        ),
                    );
                } catch (error) {
                    if (error instanceof Error) {
                        logger.error(`${error.message}\n${error.stack}`);
                    }
                }
                delete searchState[message.id];
            },
            30 * 1000,
            guild,
            msg,
        ),
        selected: [],
    };
}
