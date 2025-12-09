import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString, type LocaleKey } from '#src/lib/locales';
import { logger } from '#src/lib/logger';
import { searchState, updateHandler } from '#src/lib/state';
import type { QuaverChannels, QuaverSong } from '#src/lib/util';
import {
    acceptableSources,
    buildMessageOptions,
    Check,
    getTrackMarkdownLocaleString,
    queryOverrides,
    settings,
} from '#src/lib/util';
import type { Song } from '@lavaclient/plugin-queue';
import { msToTime, msToTimeString, paginate } from '@zptxdev/zptx-lib';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
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
        let tracks: QuaverSong[] = [];
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
            case 'track': {
                tracks =
                    result.loadType === 'track'
                        ? [result.data]
                        : result.data.tracks.map(
                              (t: QuaverSong): QuaverSong => {
                                  t.requesterId = interaction.user.id;
                                  t.id = crypto.randomUUID();
                                  return t;
                              },
                          );
                const msg =
                    result.loadType === 'track'
                        ? 'MUSIC.QUEUE.TRACK_ADDED.SINGLE.DEFAULT'
                        : 'MUSIC.QUEUE.TRACK_ADDED.MULTIPLE.DEFAULT';
                const extras =
                    result.loadType === 'track'
                        ? [getTrackMarkdownLocaleString(tracks[0])]
                        : [
                              tracks.length.toString(),
                              result.data.info.name === query
                                  ? result.data.info.name
                                  : `[${result.data.info.name}](${query})`,
                          ];
                const compatible = await guild.checkPlayerCompatibility({
                    member: interaction.member as GuildMember,
                    textChannel: interaction.channel,
                    replyHandler: interaction.replyHandler,
                });
                if (!compatible) return;
                const player = await guild.getPlayer({
                    textChannel: interaction.channel as QuaverChannels,
                    voiceChannelId: (interaction.member as GuildMember).voice
                        .channelId,
                    replyHandler: interaction.replyHandler,
                });
                if (!player) return;
                const position = await player.addTracksToQueue(
                    tracks,
                    interaction.user.id,
                );
                await interaction.replyHandler.reply(
                    new ContainerBuilder().addTextDisplayComponents(
                        guild.builders.textDisplayLocale(
                            msg as LocaleKey,
                            ...extras,
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
                return;
            }
            case 'search': {
                tracks = [...result.data];
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
                                return `\`${(index + 1)
                                    .toString()
                                    .padStart(
                                        tracks.length.toString().length,
                                        ' ',
                                    )}.\` **${getTrackMarkdownLocaleString(
                                    track,
                                )}** \`[${durationString}]\``;
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
                                            label = `${label.substring(
                                                0,
                                                99,
                                            )}…`;
                                        }
                                        return {
                                            label: label,
                                            description: track.info.author,
                                            value: track.info.uri,
                                        };
                                    },
                                ),
                            )
                            .setMinValues(0)
                            .setMaxValues(pages[0].length),
                    ),
                )
                .addActionRowComponents(
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId('search:0')
                            .setEmoji('⬅️')
                            .setDisabled(true)
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('search:2')
                            .setEmoji('➡️')
                            .setDisabled(pages.length === 1)
                            .setStyle(ButtonStyle.Primary),
                        guild.builders
                            .buttonLocale('MISC.ADD')
                            .setStyle(ButtonStyle.Success)
                            .setCustomId('search:add')
                            .setDisabled(true),
                        guild.builders
                            .buttonLocale('MISC.CANCEL')
                            .setStyle(ButtonStyle.Secondary)
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
            pages: pages,
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
    });
