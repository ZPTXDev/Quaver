import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { Check, cleanURIForMarkdown, settings } from '#src/lib/util';
import type { Song } from '@lavaclient/plugin-queue';
import { msToTime, msToTimeString, paginate } from '@zptxdev/zptx-lib';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    escapeMarkdown,
    SeparatorBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
} from 'discord.js';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('queue')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.QUEUE.DESCRIPTION',
                ),
            ),
    )
    .setChecks([
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ])
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        if (player.queue.tracks.length === 0) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.QUEUE.RESPONSE.QUEUE_EMPTY'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const showArtist = (await guild.settings.get<boolean>('showartist')) ?? true;
        const showSourceLabels = (await guild.settings.get<boolean>('showsourcelabels')) ?? false;
        const pages = paginate(player.queue.tracks, 5);
        await interaction.replyHandler.reply(
            new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        pages[0]
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

                                // Calculate remaining characters for the line
                                const indexStr = `\`${index + 1}.\` `;
                                const durationStr = ` \`[${durationString}]\``;
                                const mentionStr = ` <@${track.requesterId}>`;
                                const baseLength = indexStr.length + durationStr.length + mentionStr.length;

                                // Discord's limit is 2000 per message, but we need to be more conservative
                                // to account for multiple lines. Let's limit each track display to ~300 chars
                                const maxTrackDisplayLength = 300 - baseLength;
                                if (trackDisplay.length > maxTrackDisplayLength) {
                                    // Truncate the track display, accounting for markdown
                                    const ellipsis = '…';
                                    if (track.info.title === track.info.uri) {
                                        trackDisplay = `${sourcePrefix}**${track.info.uri.substring(0, maxTrackDisplayLength - sourcePrefix.length - 3 - ellipsis.length)}${ellipsis}**`;
                                    } else {
                                        const urlLength = track.info.uri.length + 4; // [**]() markup
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
                        '1',
                        pages.length.toString(),
                    ),
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    new ActionRowBuilder<ButtonBuilder>().setComponents(
                        new ButtonBuilder()
                            .setCustomId('queue:0')
                            .setEmoji(settings.emojis.left)
                            .setDisabled(true)
                            .setStyle(ButtonStyle.Secondary),
                        guild.builders
                            .buttonLocale('MISC.GO_TO')
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId('queue:goto'),
                        new ButtonBuilder()
                            .setCustomId('queue:2')
                            .setEmoji(settings.emojis.right)
                            .setDisabled(pages.length === 1)
                            .setStyle(ButtonStyle.Secondary),
                    ),
                ),
            { ephemeral: true },
        );
    });
