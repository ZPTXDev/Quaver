import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { ModalSubmitHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { cleanURIForMarkdown, settings } from '#src/lib/util';
import type { Song } from '@lavaclient/plugin-queue';
import { msToTime, msToTimeString, paginate } from '@zptxdev/zptx-lib';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    escapeMarkdown,
    SeparatorBuilder,
    TextDisplayBuilder,
} from 'discord.js';

export default new ModalSubmitHandler().setExecute(
    async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        const page = parseInt(
            interaction.fields.getTextInputValue('queue:goto:input'),
        );
        let pages;
        if (isNaN(page)) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.QUEUE.RESPONSE.OUT_OF_RANGE'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        if (player) pages = paginate(player.queue.tracks, 5);
        if (!player || pages?.length === 0) {
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
        if (page < 1 || page > pages.length) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.QUEUE.RESPONSE.OUT_OF_RANGE'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const showArtist = (await guild.settings.get<boolean>('showartist')) ?? true;
        const firstIndex = 5 * (page - 1) + 1;
        const pageSize = pages[page - 1].length;
        const largestIndexSize = (firstIndex + pageSize - 1).toString().length;
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
                                let trackDisplay: string;
                                if (track.info.title === track.info.uri) {
                                    trackDisplay = `**${track.info.uri}**`;
                                } else if (showArtist && track.info.author) {
                                    trackDisplay = `[**${escapeMarkdown(cleanURIForMarkdown(track.info.author))} - ${escapeMarkdown(cleanURIForMarkdown(track.info.title))}**](${track.info.uri})`;
                                } else {
                                    trackDisplay = `[**${escapeMarkdown(cleanURIForMarkdown(track.info.title))}**](${track.info.uri})`;
                                }
                                return `\`${(firstIndex + index)
                                    .toString()
                                    .padStart(largestIndexSize, ' ')}.\` ${trackDisplay} \`[${durationString}]\` <@${track.requesterId}>`;
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
                    new ActionRowBuilder<ButtonBuilder>().setComponents(
                        new ButtonBuilder()
                            .setCustomId(`queue:${page - 1}`)
                            .setEmoji(settings.emojis.left)
                            .setDisabled(page - 1 < 1)
                            .setStyle(ButtonStyle.Secondary),
                        guild.builders
                            .buttonLocale('MISC.GO_TO')
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId('queue:goto'),
                        new ButtonBuilder()
                            .setCustomId(`queue:${page + 1}`)
                            .setEmoji(settings.emojis.right)
                            .setDisabled(page + 1 > pages.length)
                            .setStyle(ButtonStyle.Secondary),
                    ),
                ),
            { force: ForceType.Update },
        );
        return;
    },
);
