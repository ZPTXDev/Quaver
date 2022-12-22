import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import { LyricsFinder } from '@jeve/lyrics-finder';
import type {
    APIEmbedField,
    ChatInputCommandInteraction,
    SlashCommandStringOption,
} from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    SlashCommandBuilder,
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription(
            getLocaleString(
                settings.defaultLocaleCode,
                'CMD.LYRICS.DESCRIPTION',
            ),
        )
        .addStringOption(
            (option): SlashCommandStringOption =>
                option
                    .setName('query')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.LYRICS.OPTION.QUERY',
                        ),
                    ),
        ),
    permissions: {
        user: [],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
        let query = interaction.options.getString('query');
        if (!query) {
            const player = interaction.guildId
                ? interaction.client.music.players.get(interaction.guildId)
                : null;
            if (
                !interaction.guildId ||
                !player?.queue.current ||
                (!player?.playing && !player?.paused)
            ) {
                await interaction.replyHandler.locale(
                    'CMD.LYRICS.RESPONSE.NO_QUERY',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
            query = player.queue.current.title;
        }
        await interaction.deferReply();
        let lyrics: string | Error;
        try {
            lyrics = await LyricsFinder(query);
        } catch (error) {
            await interaction.replyHandler.locale(
                'CMD.LYRICS.RESPONSE.NO_RESULTS',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        if (lyrics instanceof Error) {
            await interaction.replyHandler.locale(
                'CMD.LYRICS.RESPONSE.NO_RESULTS',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        let romanizeFrom = '';
        // use regex to check if lyrics have any korean characters
        if (
            lyrics.match(
                /[\uac00-\ud7af]|[\u1100-\u11ff]|[\u3130-\u318f]|[\ua960-\ua97f]|[\ud7b0-\ud7ff]/g,
            )
        ) {
            romanizeFrom = 'korean';
        } else if (lyrics.match(/[\u3040-\u309f]|[\u30a0-\u30ff]/g)) {
            romanizeFrom = 'japanese';
        } else if (lyrics.match(/[\u4e00-\u9fff]/g)) {
            romanizeFrom = 'chinese';
        }
        let lyricsFields: APIEmbedField[] = [];
        // try method 1
        let giveUp = false;
        if (lyrics.split('\n\n').length === 1) giveUp = true;
        lyrics.split('\n\n').reduce((previous, chunk, index, array): string => {
            if (giveUp) return;
            if (chunk.length > 1024) giveUp = true;
            if (previous.length + chunk.length + '\n\n'.length > 1024) {
                lyricsFields.push({
                    name: lyricsFields.length === 0 ? query : '​',
                    value: previous,
                });
                return chunk;
            }
            if (index === array.length - 1) {
                lyricsFields.push({
                    name: lyricsFields.length === 0 ? query : '​',
                    value: previous + '\n\n' + chunk,
                });
            }
            return previous + '\n\n' + chunk;
        });
        if (giveUp) {
            lyricsFields = [];
            // try method 2
            lyrics
                .split('\n')
                .reduce((previous, line, index, array): string => {
                    if (previous.length + line.length + '\n'.length > 1024) {
                        lyricsFields.push({
                            name: lyricsFields.length === 0 ? query : '​',
                            value: previous,
                        });
                        return line;
                    }
                    if (index === array.length - 1) {
                        lyricsFields.push({
                            name: lyricsFields.length === 0 ? query : '​',
                            value: previous + '\n' + line,
                        });
                    }
                    return previous + '\n' + line;
                }, '');
        }
        if (
            lyricsFields.reduce(
                (previous, current): number => previous + current.value.length,
                0,
            ) > 6000
        ) {
            let exceedIndex = -1;
            lyricsFields.reduce((previous, current, index): number => {
                if (exceedIndex !== -1) return;
                if (previous + current.value.length > 6000) {
                    exceedIndex = index;
                }
                return previous + current.value.length;
            }, 0);
            lyricsFields = lyricsFields.slice(0, exceedIndex);
            lyricsFields.push({ name: '​', value: '`...`' });
        }
        if (lyricsFields.length === 0) {
            await interaction.replyHandler.locale(
                'CMD.LYRICS.RESPONSE.NO_RESULTS',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        await interaction.replyHandler.reply(
            new EmbedBuilder().setFields(lyricsFields),
            {
                components: romanizeFrom
                    ? [
                          new ActionRowBuilder<ButtonBuilder>().addComponents(
                              new ButtonBuilder()
                                  .setCustomId(`lyrics:${romanizeFrom}`)
                                  .setStyle(ButtonStyle.Secondary)
                                  .setLabel(
                                      await getGuildLocaleString(
                                          interaction.guildId,
                                          `CMD.LYRICS.MISC.ROMANIZE_FROM_${romanizeFrom.toUpperCase()}`,
                                      ),
                                  ),
                          ),
                      ]
                    : [],
            },
        );
    },
};
