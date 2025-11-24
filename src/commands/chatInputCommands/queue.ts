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
                                return `\`${index + 1}.\` ${
                                    track.info.title === track.info.uri
                                        ? `**${track.info.uri}**`
                                        : `[**${escapeMarkdown(cleanURIForMarkdown(track.info.title))}**](${track.info.uri})`
                                } \`[${durationString}]\` <@${track.requesterId}>`;
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
                            .setEmoji('⬅️')
                            .setDisabled(true)
                            .setStyle(ButtonStyle.Primary),
                        guild.builders
                            .buttonLocale('MISC.GO_TO')
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId('queue:goto'),
                        new ButtonBuilder()
                            .setCustomId('queue:2')
                            .setEmoji('➡️')
                            .setDisabled(pages.length === 1)
                            .setStyle(ButtonStyle.Primary),
                    ),
                ),
            { ephemeral: true },
        );
    });
