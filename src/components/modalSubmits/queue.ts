import { ForceType } from '#src/lib/ReplyHandler.js';
import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { data, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import {
    cleanURIForMarkdown,
    getGuildLocaleString,
    getLocaleString,
} from '#src/lib/util/util.js';
import type { Song } from '@lavaclient/plugin-queue';
import { msToTime, msToTimeString, paginate } from '@zptxdev/zptx-lib';
import type {
    MessageActionRowComponentBuilder,
    ModalSubmitInteraction,
} from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    escapeMarkdown,
} from 'discord.js';

export default {
    name: 'queue',
    async execute(
        interaction: QuaverInteraction<ModalSubmitInteraction>,
    ): Promise<void> {
        const player = await interaction.client.music.players.fetch(
                interaction.guildId,
            ),
            page = parseInt(
                interaction.fields.getTextInputValue('queue:goto:input'),
            );
        let pages;
        if (isNaN(page)) {
            await interaction.replyHandler.locale(
                'CMD.QUEUE.RESPONSE.OUT_OF_RANGE',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        if (player) pages = paginate(player.queue.tracks, 5);
        if (!player || pages?.length === 0) {
            await interaction.replyHandler.locale(
                'CMD.QUEUE.RESPONSE.QUEUE_EMPTY',
                {
                    type: MessageOptionsBuilderType.Error,
                    components: [],
                    force: ForceType.Update,
                },
            );
            return;
        }
        if (page < 1 || page > pages.length) {
            await interaction.replyHandler.locale(
                'CMD.QUEUE.RESPONSE.OUT_OF_RANGE',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const firstIndex = 5 * (page - 1) + 1;
        const pageSize = pages[page - 1].length;
        const largestIndexSize = (firstIndex + pageSize - 1).toString().length;
        const original = {
            embeds: interaction.message.embeds,
            components: interaction.message.components,
        };
        if (original.embeds.length === 0) {
            await interaction.message.delete();
            return;
        }
        const updated: {
            embeds: EmbedBuilder[];
            components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
        } = { embeds: [], components: [] };
        const guildLocaleCode =
            (await data.guild.get<string>(
                interaction.guildId,
                'settings.locale',
            )) ?? settings.defaultLocaleCode;
        updated.embeds[0] = EmbedBuilder.from(original.embeds[0])
            .setDescription(
                pages[page - 1]
                    .map((track: Song, index: number): string => {
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
                        return `\`${(firstIndex + index)
                            .toString()
                            .padStart(largestIndexSize, ' ')}.\` ${
                            track.info.title === track.info.uri
                                ? `**${track.info.uri}**`
                                : `[**${escapeMarkdown(cleanURIForMarkdown(track.info.title))}**](${track.info.uri})`
                        } \`[${durationString}]\` <@${track.requesterId}>`;
                    })
                    .join('\n'),
            )
            .setFooter({
                text: await getGuildLocaleString(
                    interaction.guildId,
                    'MISC.PAGE',
                    page.toString(),
                    pages.length.toString(),
                ),
            });
        updated.components[0] =
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`queue:${page - 1}`)
                    .setEmoji('⬅️')
                    .setDisabled(page - 1 < 1)
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('queue:goto')
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(
                        await getGuildLocaleString(
                            interaction.guildId,
                            'MISC.GO_TO',
                        ),
                    ),
                new ButtonBuilder()
                    .setCustomId(`queue:${page + 1}`)
                    .setEmoji('➡️')
                    .setDisabled(page + 1 > pages.length)
                    .setStyle(ButtonStyle.Primary),
            );
        await interaction.replyHandler.reply(updated.embeds, {
            components: updated.components,
            force: ForceType.Update,
        });
        return;
    },
};
