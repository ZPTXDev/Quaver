import { ComponentType, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { convert as romanizeFromKorean } from 'hangul-romanization';
import { pinyin as romanizeFromChinese } from 'pinyin-pro';
import { toRomaji as romanizeFromJapanese } from 'wanakana';
import { ButtonHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { MessageOptionsBuilderType } from '#src/lib/util/common';

export default new ButtonHandler().setExecute(
    async function(interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const romanizeFrom = interaction.customId.split(':')[1];
        if (
            interaction.message.components[0]?.type !==
                ComponentType.Container ||
            interaction.message.components[0].components[0]?.type !==
                ComponentType.TextDisplay ||
            interaction.message.components[0].components[1]?.type !==
                ComponentType.TextDisplay
        ) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.LYRICS.RESPONSE.ROMANIZATION_FAILED'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const title = interaction.message.components[0].components[0].content;
        let lyrics = interaction.message.components[0].components[1].content;
        switch (romanizeFrom) {
            case 'korean':
                lyrics = romanizeFromKorean(lyrics);
                break;
            case 'japanese': {
                lyrics = romanizeFromJapanese(lyrics);
                break;
            }
            case 'chinese':
                lyrics = lyrics
                    // keep line structure (including empty lines)
                    .split(/\r?\n/)
                    .map((line): string => {
                        // preserve completely blank lines as-is
                        if (!line.trim()) return '';

                        // per-character conversion, only for Hanzi
                        const converted = [...line]
                            .map((ch): string => {
                                if (/[\u4e00-\u9fff]/.test(ch)) {
                                    // add a space after each syllable so they don’t glue together
                                    return romanizeFromChinese(ch) + ' ';
                                }
                                return ch;
                            })
                            .join('');

                        // clean up punctuation + extra spaces *for this line only*
                        return converted
                            .replace(/，/g, ',')
                            .replace(/。/g, '.')
                            .replace(/\s*,\s*/g, ', ')
                            .replace(/\s*\.\s*/g, '. ')
                            .replace(/[ \t]+/g, ' ')
                            .trimEnd();
                    })
                    .join('\n');
        }
        // we'll re-use this since the length limit is affected by it
        const japaneseInaccurate = guild.locale(
            'CMD.LYRICS.MISC.JAPANESE_INACCURATE',
        );
        const maxLength =
            4000 -
            title.length -
            (romanizeFrom === 'japanese' ? japaneseInaccurate.length : 0);
        if (lyrics.length > maxLength) {
            lyrics = `${lyrics.slice(0, maxLength - 1)}…`;
        }
        if (lyrics.length === 0) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.LYRICS.RESPONSE.ROMANIZATION_FAILED'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        await interaction.replyHandler.reply(
            new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(title),
                new TextDisplayBuilder().setContent(lyrics),
                ...(romanizeFrom === 'japanese'
                    ? [new TextDisplayBuilder().setContent(japaneseInaccurate)]
                    : []),
            ),
        );
    },
);
