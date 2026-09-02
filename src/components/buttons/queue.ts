import { ForceType, MessageOptionsBuilderType } from '#src/lib';
import { ButtonHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { cleanURIForMarkdown, settings } from '#src/lib/util';
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
        const showArtist = (await guild.settings.get<boolean>('showartist')) ?? true;
        const showSourceLabels = (await guild.settings.get<boolean>('showsourcelabels')) ?? false;
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
                                let trackDisplay: string;
                                const sourceEmoji = showSourceLabels && track.info.sourceName
                                    ? settings.emojis?.[track.info.sourceName as keyof typeof settings.emojis] || ''
                                    : '';
                                const sourcePrefix = sourceEmoji ? `${sourceEmoji} ` : '';

                                if (track.info.title === track.info.uri) {
                                    trackDisplay = `${sourcePrefix}**${track.info.uri}**`;
                                } else if (showArtist && track.info.author) {
                                    trackDisplay = `${sourcePrefix}[**${escapeMarkdown(cleanURIForMarkdown(track.info.author))} - ${escapeMarkdown(cleanURIForMarkdown(track.info.title))}**](${track.info.uri})`;
                                } else {
                                    trackDisplay = `${sourcePrefix}[**${escapeMarkdown(cleanURIForMarkdown(track.info.title))}**](${track.info.uri})`;
                                }

                                const indexStr = `\`${(firstIndex + index)
                                    .toString()
                                    .padStart(largestIndexSize, ' ')}.\` `;
                                const durationStr = ` \`[${durationString}]\``;
                                const mentionStr = ` <@${track.requesterId}>`;
                                const baseLength = indexStr.length + durationStr.length + mentionStr.length;

                                const maxTrackDisplayLength = 300 - baseLength;
                                if (trackDisplay.length > maxTrackDisplayLength) {
                                    const ellipsis = '…';
                                    if (track.info.title === track.info.uri) {
                                        trackDisplay = `${sourcePrefix}**${track.info.uri.substring(0, maxTrackDisplayLength - sourcePrefix.length - 3 - ellipsis.length)}${ellipsis}**`;
                                    } else {
                                        // [**]() markup
                                        const urlLength = track.info.uri.length + 4;
                                        const maxTitleLength = maxTrackDisplayLength - sourcePrefix.length - urlLength - ellipsis.length;
                                        if (showArtist && track.info.author) {
                                            const titlePart = `${escapeMarkdown(cleanURIForMarkdown(track.info.author))} - ${escapeMarkdown(cleanURIForMarkdown(track.info.title))}`;
                                            trackDisplay = `${sourcePrefix}[**${titlePart.substring(0, maxTitleLength)}${ellipsis}**](${track.info.uri})`;
                                        } else {
                                            const titlePart = escapeMarkdown(cleanURIForMarkdown(track.info.title));
                                            trackDisplay = `${sourcePrefix}[**${titlePart.substring(0, maxTitleLength)}${ellipsis}**](${track.info.uri})`;
                                        }
                                    }
                                }

                                return `${indexStr}${trackDisplay}${durationStr}${mentionStr}`;
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
    },
);
