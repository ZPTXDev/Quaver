import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild, type Initialized } from '#src/lib/guild';
import type { LavalinkAPI } from 'lavalink-api-client';
import { getLocaleString, type LocaleKey } from '#src/lib/locales';
import { logger } from '#src/lib/logger';
import { searchState, updateHandler } from '#src/lib/state';
import type { QuaverInteraction } from '#src/lib/interactions';
import type { QuaverChannels, QuaverSong } from '#src/lib/util';
import {
    buildMessageOptions,
    Check,
    getTrackMarkdownLocaleString,
    searchTracks,
    settings,
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
        const result = await searchTracks(
            interaction.client,
            guild,
            query,
        );
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

async function handleImmediateAdd(
    interaction: QuaverInteraction<ChatInputCommandInteraction>,
    guild: QuaverGuild<Initialized>,
    result: Extract<Awaited<ReturnType<LavalinkAPI['loadTracks']>>, { loadType: 'track' | 'playlist' }>,
    query: string,
): Promise<void> {
    const tracks =
        result.loadType === 'track'
            ? [
                  ((): QuaverSong => {
                      const track = result.data as QuaverSong;
                      track.requesterId = interaction.user.id;
                      track.id = crypto.randomUUID();
                      return track;
                  })(),
              ]
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
        voiceChannelId: (interaction.member as GuildMember).voice.channelId,
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
    guild.sendWebUpdate('queueUpdate', player.decorateQueue());
}

async function renderSearchResults(
    interaction: QuaverInteraction<ChatInputCommandInteraction>,
    guild: QuaverGuild<Initialized>,
    tracks: QuaverSong[],
): Promise<void> {
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
