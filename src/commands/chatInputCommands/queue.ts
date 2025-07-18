import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { data, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import {
    cleanURIForMarkdown,
    getGuildLocaleString,
    getLocaleString,
} from '#src/lib/util/util.js';
import type { Song } from '@lavaclient/plugin-queue';
import { msToTime, msToTimeString, paginate } from '@zptxdev/zptx-lib';
import type { ChatInputCommandInteraction } from 'discord.js';
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
        const player = await interaction.client.music.players.fetch(
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
            new ContainerBuilder({
                components: [
                    new TextDisplayBuilder()
                        .setContent(
                            pages[0]
                                .map((track: Song, index): string => {
                                    const duration = msToTime(
                                        track.info.length,
                                    );
                                    let durationString = track.info.isStream
                                        ? '∞'
                                        : msToTimeString(duration, true);
                                    if (durationString === 'MORE_THAN_A_DAY') {
                                        durationString = getLocaleString(
                                            guildLocaleCode,
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
                        )
                        .toJSON(),
                    new TextDisplayBuilder()
                        .setContent(
                            await getGuildLocaleString(
                                interaction.guildId,
                                'MISC.PAGE',
                                '1',
                                pages.length.toString(),
                            ),
                        )
                        .toJSON(),
                    new SeparatorBuilder().toJSON(),
                    new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
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
                        )
                        .toJSON(),
                ],
            }),
            { ephemeral: true },
        );
    },
};
