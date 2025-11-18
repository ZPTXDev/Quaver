import type { Song } from '@lavaclient/plugin-queue';
import { msToTime, msToTimeString, paginate } from '@zptxdev/zptx-lib';
import {
    ActionRowBuilder,
    type ApplicationCommandManager,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ContainerBuilder,
    escapeMarkdown,
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
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import {
    logger,
    MessageOptionsBuilderType,
    searchState,
} from '#src/lib/util/common';
import { Check } from '#src/lib/util/constants';
import { settings } from '#src/lib/util/settings';
import {
    buildMessageOptions,
    cleanURIForMarkdown,
    getLocaleString,
} from '#src/lib/util/util';

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
    .setExecute(async function(interaction): Promise<void> {
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
        if (interaction.client.music.ws.state !== LavalinkWSClientState.Ready) {
            await interaction.replyHandler.reply(
                guild.locale('MUSIC.NOT_READY'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        await interaction.deferReply();
        const query = interaction.options.getString('query');
        // this should be Track[] but lavaclient doesn't export it so
        // we should be using ReturnType<typeof x> but can't seem to
        // figure it out rn so we'll deal with this in subsequent
        // commits
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let tracks: any[] = [];
        const result = await interaction.client.music.api.loadTracks(
            `ytsearch:${query}`,
        );
        if (result.loadType === 'search') tracks = [...result.data];
        if (tracks.length <= 1) {
            const applicationCommands: ApplicationCommandManager =
                interaction.client.application?.commands;
            if (applicationCommands.cache.size === 0) {
                await applicationCommands.fetch();
            }
            await interaction.replyHandler.reply(
                guild.locale(
                    'CMD.SEARCH.RESPONSE.USE_PLAY_CMD',
                    applicationCommands.cache.find(
                        (command): boolean => command.name === 'play',
                    )?.id ?? '1',
                ),
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
                                    )}.\` ${
                                    track.info.title === track.info.uri
                                        ? `**${track.info.uri}**`
                                        : `[**${escapeMarkdown(cleanURIForMarkdown(track.info.title))}**](${track.info.uri})`
                                } \`[${durationString}]\``;
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
                                            value: track.info.identifier,
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
                            logger.error({
                                message: `${error.message}\n${error.stack}`,
                                label: 'Quaver',
                            });
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
