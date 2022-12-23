import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { MessageOptionsBuilderType } from '#src/lib/util/common.js';
import {
    generateEmbedFieldsFromLyrics,
    getGuildLocaleString,
} from '#src/lib/util/util.js';
import { LyricsFinder } from '@jeve/lyrics-finder';
import { pinyin as romanizeFromChinese, PINYIN_STYLE } from '@napi-rs/pinyin';
import type { ButtonInteraction } from 'discord.js';
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
        const lyricsFields = generateEmbedFieldsFromLyrics(query, lyrics);
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
