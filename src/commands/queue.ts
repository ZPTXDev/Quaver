import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { data, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import { msToTime, msToTimeString, paginate } from '@zptxdev/zptx-lib';
import type { ChatInputCommandInteraction } from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    escapeMarkdown,
    SlashCommandBuilder,
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription(
            getLocaleString(
                settings.defaultLocaleCode,
                'CMD.QUEUE.DESCRIPTION',
            ),
        ),
    checks: [
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ],
    permissions: {
        user: [],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
        const player = interaction.client.music.players.get(
            interaction.guildId,
        );
        if (player.queue.tracks.length === 0) {
            await interaction.replyHandler.locale(
                'CMD.QUEUE.RESPONSE.QUEUE_EMPTY',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const pages = paginate(player.queue.tracks, 5);
        const guildLocaleCode =
            (await data.guild.get<string>(
                interaction.guildId,
                'settings.locale',
            )) ?? settings.defaultLocaleCode;
        await interaction.replyHandler.reply(
            new EmbedBuilder()
                .setDescription(
                    pages[0]
                        .map((track, index): string => {
                            const duration = msToTime(track.length);
                            let durationString = track.isStream
                                ? '∞'
                                : msToTimeString(duration, true);
                            if (durationString === 'MORE_THAN_A_DAY') {
                                durationString = getLocaleString(
                                    guildLocaleCode,
                                    'MISC.MORE_THAN_A_DAY',
                                );
                            }
                            return `\`${index + 1}.\` **[${escapeMarkdown(
                                track.title,
                            )}](${track.uri})** \`[${durationString}]\` <@${
                                track.requester
                            }>`;
                        })
                        .join('\n'),
                )
                .setFooter({
                    text: await getGuildLocaleString(
                        interaction.guildId,
                        'MISC.PAGE',
                        '1',
                        pages.length.toString(),
                    ),
                }),
            {
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId('queue:0')
                            .setEmoji('⬅️')
                            .setDisabled(true)
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
                            .setCustomId('queue:2')
                            .setEmoji('➡️')
                            .setDisabled(pages.length === 1)
                            .setStyle(ButtonStyle.Primary),
                    ),
                ],
                ephemeral: true,
            },
        );
    },
};
