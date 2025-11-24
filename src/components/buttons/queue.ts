import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { ButtonHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { cleanURIForMarkdown } from '#src/lib/util';
import type { Song } from '@lavaclient/plugin-queue';
import { msToTime, msToTimeString, paginate } from '@zptxdev/zptx-lib';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    ContainerComponent,
    escapeMarkdown,
    ModalBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';

export default new ButtonHandler().setExecute(
    async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        const pages = player ? paginate(player.queue.tracks, 5) : [];
        const target = interaction.customId.split(':')[1];
        if (player && target === 'goto' && pages.length !== 0) {
            return interaction.showModal(
                new ModalBuilder()
                    .setTitle(guild.locale('CMD.QUEUE.MISC.MODAL_TITLE'))
                    .setCustomId('queue:goto')
                    .addLabelComponents(
                        guild.builders
                            .labelLocale('CMD.QUEUE.MISC.PAGE')
                            .setTextInputComponent(
                                new TextInputBuilder()
                                    .setCustomId('queue:goto:input')
                                    .setStyle(TextInputStyle.Short),
                            ),
                    ),
            );
        }
        const page = parseInt(target);
        if (!player || pages.length === 0 || page < 1 || page > pages.length) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.QUEUE.RESPONSE.QUEUE_EMPTY'),
                {
                    type: MessageOptionsBuilderType.Error,
                    components: [],
                    force: ForceType.Update,
                },
            );
            return;
        }
        const firstIndex = 5 * (page - 1) + 1;
        const pageSize = pages[page - 1].length;
        const largestIndexSize = (firstIndex + pageSize - 1).toString().length;
        if (
            !(interaction.message.components[0] instanceof ContainerComponent)
        ) {
            await interaction.replyHandler.reply(
                guild.locale('DISCORD.INTERACTION.EXPIRED'),
                { components: [], force: ForceType.Update },
            );
            return;
        }
        await interaction.replyHandler.reply(
            new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        pages[page - 1]
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
                                return `\`${(firstIndex + index)
                                    .toString()
                                    .padStart(largestIndexSize, ' ')}.\` ${
                                    track.info.title === track.info.uri
                                        ? `**${track.info.uri}**`
                                        : `[**${escapeMarkdown(cleanURIForMarkdown(track.info.title))}**](${track.info.uri})`
                                } \`[${durationString}]\` <@${track.requesterId}>`;
                            })
                            .join('\n'),
                    ),
                    guild.builders.textDisplayLocale(
                        'MISC.PAGE',
                        page.toString(),
                        pages.length.toString(),
                    ),
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`queue:${page - 1}`)
                            .setEmoji('⬅️')
                            .setDisabled(page - 1 < 1)
                            .setStyle(ButtonStyle.Primary),
                        guild.builders
                            .buttonLocale('MISC.GO_TO')
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId('queue:goto'),
                        new ButtonBuilder()
                            .setCustomId(`queue:${page + 1}`)
                            .setEmoji('➡️')
                            .setDisabled(page + 1 > pages.length)
                            .setStyle(ButtonStyle.Primary),
                    ),
                ),
            { force: ForceType.Update },
        );
    },
);
