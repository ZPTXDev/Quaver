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
                                if (track.info.title === track.info.uri) {
                                    trackDisplay = `**${track.info.uri}**`;
                                } else if (showArtist && track.info.author) {
                                    trackDisplay = `[**${escapeMarkdown(cleanURIForMarkdown(track.info.author))} - ${escapeMarkdown(cleanURIForMarkdown(track.info.title))}**](${track.info.uri})`;
                                } else {
                                    trackDisplay = `[**${escapeMarkdown(cleanURIForMarkdown(track.info.title))}**](${track.info.uri})`;
                                }
                                return `\`${index + 1}.\` ${trackDisplay} \`[${durationString}]\` <@${track.requesterId}>`;
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
