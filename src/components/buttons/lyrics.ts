import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { data, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { getLocaleString } from '#src/lib/util/util.js';
import { pinyin as romanizeFromChinese, PINYIN_STYLE } from '@napi-rs/pinyin';
import type { ButtonInteraction } from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
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
import { settings } from '#src/lib/util/settings.js';

const kuroshiro = new Kuroshiro.default();
await kuroshiro.init(new KuromojiAnalyzer());

export default {
    name: 'lyrics',
    checks: [],
    async execute(
        interaction: QuaverInteraction<ButtonInteraction>,
    ): Promise<void> {
        const romanizeFrom = interaction.customId.split(':')[1];
        if (
            interaction.message.components[0]?.type !==
                ComponentType.Container ||
            interaction.message.components[0].components[0]?.type !==
                ComponentType.TextDisplay ||
            interaction.message.components[0].components[1]?.type !==
                ComponentType.TextDisplay
        ) {
            await interaction.replyHandler.locale(
                'CMD.LYRICS.RESPONSE.ROMANIZATION_FAILED',
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
        const guildLocaleCode =
            (await data.guild.get<string>(
                interaction.guildId,
                'settings.locale',
            )) ?? settings.defaultLocaleCode;
        const japaneseInaccurate = getLocaleString(
            guildLocaleCode,
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
                getLocaleString(
                    guildLocaleCode,
                    'CMD.LYRICS.RESPONSE.ROMANIZATION_FAILED',
                ),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        await interaction.replyHandler.reply(
            new ContainerBuilder({
                components: [
                    new TextDisplayBuilder().setContent(title).toJSON(),
                    new TextDisplayBuilder().setContent(lyrics).toJSON(),
                    ...(romanizeFrom === 'japanese'
                        ? [
                              new TextDisplayBuilder()
                                  .setContent(japaneseInaccurate)
                                  .toJSON(),
                          ]
                        : []),
                    ...(romanizeFrom
                        ? [
                              new SeparatorBuilder().toJSON(),
                              new ActionRowBuilder<ButtonBuilder>()
                                  .addComponents(
                                      new ButtonBuilder()
                                          .setCustomId(`lyrics:${romanizeFrom}`)
                                          .setStyle(ButtonStyle.Secondary)
                                          .setLabel(
                                              getLocaleString(
                                                  guildLocaleCode,
                                                  `CMD.LYRICS.MISC.ROMANIZE_FROM_${romanizeFrom.toUpperCase()}`,
                                              ),
                                          ),
                                  )
                                  .toJSON(),
                          ]
                        : []),
                ],
            }),
        );
    },
};
