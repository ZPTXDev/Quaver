import { pinyin as romanizeFromChinese, PINYIN_STYLE } from '@napi-rs/pinyin';
import {
    ActionRowBuilder,
    type ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ContainerBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import { convert as romanizeFromKorean } from 'hangul-romanization';
import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';
import { toRomaji as romanizeFromJapanese } from 'wanakana';
import { QuaverGuild } from '#src/lib';
import { ButtonHandler } from '#src/lib/builders';
import { MessageOptionsBuilderType } from '#src/lib/util/common';

const kuroshiro = new Kuroshiro.default();
await kuroshiro.init(new KuromojiAnalyzer());

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
                lyrics = await kuroshiro.convert(lyrics);
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
            new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(title),
                    new TextDisplayBuilder().setContent(lyrics),
                    ...(romanizeFrom === 'japanese'
                        ? [
                              new TextDisplayBuilder().setContent(
                                  japaneseInaccurate,
                              ),
                          ]
                        : []),
                )
                .addSeparatorComponents(
                    ...(romanizeFrom ? [new SeparatorBuilder()] : []),
                )
                .addActionRowComponents(
                    ...(romanizeFrom
                        ? [
                              new ActionRowBuilder<ButtonBuilder>().addComponents(
                                  guild.builders
                                      .buttonLocale(
                                          `CMD.LYRICS.MISC.ROMANIZE_FROM_${romanizeFrom.toUpperCase()}`,
                                      )
                                      .setStyle(ButtonStyle.Secondary)
                                      .setCustomId(`lyrics:${romanizeFrom}`),
                              ),
                          ]
                        : []),
                ),
        );
    },
);
