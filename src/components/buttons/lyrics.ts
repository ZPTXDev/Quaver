import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { getGuildLocaleString } from '#src/lib/util/util.js';
import { LyricsFinder } from '@jeve/lyrics-finder';
import { pinyin as romanizeFromChinese, PINYIN_STYLE } from '@napi-rs/pinyin';
import type { APIEmbedField, ButtonInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { convert as romanizeFromKorean } from 'hangul-romanization';
import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';
import { toRomaji as romanizeFromJapanese } from 'wanakana';

export default {
    name: 'lyrics',
    checks: [],
    async execute(
        interaction: QuaverInteraction<ButtonInteraction>,
    ): Promise<void> {
        const romanizeFrom = interaction.customId.split(':')[1];
        const query = interaction.message.embeds[0].fields[0].name;
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
        switch (romanizeFrom) {
            case 'korean':
                lyrics = romanizeFromKorean(lyrics);
                break;
            case 'japanese': {
                const kuroshiro = new Kuroshiro();
                await kuroshiro.init(new KuromojiAnalyzer());
                lyrics = await kuroshiro.convert(lyrics);
                if (lyrics instanceof Error) {
                    await interaction.replyHandler.locale(
                        'CMD.LYRICS.RESPONSE.NO_RESULTS',
                        { type: MessageOptionsBuilderType.Error },
                    );
                    return;
                }
                lyrics = romanizeFromJapanese(lyrics);
                break;
            }
            case 'chinese':
                lyrics = lyrics
                    .split('\n')
                    .map((line): string =>
                        romanizeFromChinese(line, {
                            style: PINYIN_STYLE.WithTone,
                        }).join(' '),
                    )
                    .join('\n');
        }
        let lyricsFields: APIEmbedField[] = [];
        // try method 1
        let giveUp = false;
        if (lyrics.split('\n\n').length === 1) giveUp = true;
        lyrics.split('\n\n').reduce((previous, chunk, index, array): string => {
            if (giveUp) return;
            if (chunk.length > 1024 || !array) giveUp = true;
            if (previous.length + chunk.length > 1024) {
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
                    if (previous.length + line.length > 1024) {
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
            new EmbedBuilder().setFields(lyricsFields).setFooter({
                text:
                    romanizeFrom === 'japanese'
                        ? await getGuildLocaleString(
                              interaction.guildId,
                              'CMD.LYRICS.MISC.JAPANESE_INACCURATE',
                          )
                        : null,
            }),
        );
    },
};
