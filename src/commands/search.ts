import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import {
    data,
    logger,
    MessageOptionsBuilderType,
    searchState,
} from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import {
    buildMessageOptions,
    getGuildLocaleString,
    getLocaleString,
} from '#src/lib/util/util.js';
import type { Song } from '@lavaclient/plugin-queue';
import { msToTime, msToTimeString, paginate } from '@zptxdev/zptx-lib';
import type {
    ChatInputCommandInteraction,
    SelectMenuComponentOptionData,
    SlashCommandStringOption } from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    escapeMarkdown,
    InteractionCallbackResponse,
    Message,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';

// credit: https://github.com/lavaclient/djs-v13-example/blob/main/src/commands/Play.ts
export default {
    data: new SlashCommandBuilder()
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
    checks: [Check.GuildOnly],
    permissions: {
        user: [],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
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
            const applicationCommands =
                interaction.client.application?.commands;
            if (applicationCommands.cache.size === 0) {
                await applicationCommands.fetch();
            }
            await interaction.replyHandler.locale(
                'CMD.SEARCH.RESPONSE.USE_PLAY_CMD',
                {
                    type: MessageOptionsBuilderType.Error,
                    vars: [
                        applicationCommands.cache.find(
                            (command): boolean => command.name === 'play',
                        )?.id ?? '1',
                    ],
                },
            );
            return;
        }
        const pages = paginate(tracks, 10);
        const guildLocaleCode =
            (await data.guild.get<string>(
                interaction.guildId,
                'settings.locale',
            )) ?? settings.defaultLocaleCode;
        const response = await interaction.replyHandler.reply(
            new EmbedBuilder()
                .setDescription(
                    pages[0]
                        .map((track: Song, index): string => {
                            const duration = msToTime(track.info.length);
                            let durationString = track.info.isStream
                                ? '∞'
                                : msToTimeString(duration, true);
                            if (durationString === 'MORE_THAN_A_DAY') {
                                durationString = getLocaleString(
                                    guildLocaleCode,
                                    'MISC.MORE_THAN_A_DAY',
                                );
                            }
                            return `\`${(index + 1)
                                .toString()
                                .padStart(
                                    tracks.length.toString().length,
                                    ' ',
                                )}.\` **[${escapeMarkdown(track.info.title)}](${
                                track.info.uri
                            })** \`[${durationString}]\``;
                        })
                        .join('\n'),
                )
                .setFooter({
                    text: await getGuildLocaleString(
                        interaction.guildId,
                        'MISC.PAGE',
                        '1',
                        pages.length.toString(),
                    ),
                }),
            {
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('search')
                            .setPlaceholder(
                                await getGuildLocaleString(
                                    interaction.guildId,
                                    'CMD.SEARCH.MISC.PICK',
                                ),
                            )
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
                                                97,
                                            )}...`;
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
                        new ButtonBuilder()
                            .setCustomId('search:add')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(true)
                            .setLabel(
                                await getGuildLocaleString(
                                    interaction.guildId,
                                    'MISC.ADD',
                                ),
                            ),
                        new ButtonBuilder()
                            .setCustomId('cancel')
                            .setStyle(ButtonStyle.Secondary)
                            .setLabel(
                                await getGuildLocaleString(
                                    interaction.guildId,
                                    'MISC.CANCEL',
                                ),
                            ),
                    ),
                ],
                withResponse: true,
            },
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
                async (message): Promise<void> => {
                    try {
                        await message.edit(
                            buildMessageOptions(
                                new EmbedBuilder().setDescription(
                                    await getGuildLocaleString(
                                        message.guildId,
                                        'DISCORD.INTERACTION.EXPIRED',
                                    ),
                                ),
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
                msg,
            ),
            selected: [],
        };
    },
};
