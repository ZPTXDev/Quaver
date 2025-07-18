import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { data, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import {
    cleanURIForMarkdown,
    getGuildLocaleString,
    getLocaleString,
} from '#src/lib/util/util.js';
import { LoopType } from '@lavaclient/plugin-queue';
import { getBar, msToTime, msToTimeString } from '@zptxdev/zptx-lib';
import type { ChatInputCommandInteraction } from 'discord.js';
import { escapeMarkdown, SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('playing')
        .setDescription(
            getLocaleString(
                settings.defaultLocaleCode,
                'CMD.PLAYING.DESCRIPTION',
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
        const player = (await interaction.client.music.players.fetch(
            interaction.guildId,
        )) as QuaverPlayer;
        // workaround: seems like current track doesn't get removed after the track, an issue with @lavaclient/queue
        if (!player.queue.current || (!player.playing && !player.paused)) {
            await interaction.replyHandler.locale(
                'MUSIC.PLAYER.PLAYING.NOTHING',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const bar = getBar(
            (player.position / player.queue.current.info.length) * 100,
        );
        let elapsed = msToTime(player.position);
        if (isNaN(elapsed['s']) || elapsed['s'] < 0) {
            elapsed = { d: 0, h: 0, m: 0, s: 0 };
        }
        let elapsedString = msToTimeString(elapsed, true);
        if (elapsedString === 'MORE_THAN_A_DAY') {
            elapsedString = await getGuildLocaleString(
                interaction.guildId,
                'MISC.MORE_THAN_A_DAY',
            );
        }
        const duration = msToTime(player.queue.current.info.length);
        let durationString = msToTimeString(duration, true);
        if (durationString === 'MORE_THAN_A_DAY') {
            durationString = await getGuildLocaleString(
                interaction.guildId,
                'MISC.MORE_THAN_A_DAY',
            );
        }
        if (player.queue.current.info.isStream) {
            const guildLocaleCode =
                (await data.guild.get<string>(
                    interaction.guildId,
                    'settings.locale',
                )) ?? settings.defaultLocaleCode;
            await interaction.replyHandler.reply(
                `${
                    player.queue.current.info.title ===
                    player.queue.current.info.uri
                        ? `**${player.queue.current.info.uri}**`
                        : `[**${escapeMarkdown(cleanURIForMarkdown(player.queue.current.info.title))}**](${player.queue.current.info.uri})`
                }\n🔴 **${getLocaleString(
                    guildLocaleCode,
                    'MISC.LIVE',
                )}** ${'▬'.repeat(10)}${player.paused ? ' ⏸️' : ''}${
                    player.queue.loop.type !== LoopType.None
                        ? ` ${
                              player.queue.loop.type === LoopType.Queue
                                  ? '🔁'
                                  : '🔂'
                          }`
                        : ''
                }${player.bassboost ? ' 🅱️' : ''}\n\`[${getLocaleString(
                    guildLocaleCode,
                    'MISC.STREAMING',
                )}]\` | ${getLocaleString(
                    guildLocaleCode,
                    'MISC.ADDED_BY',
                    player.queue.current.requesterId,
                )}`,
                { ephemeral: true },
            );
            return;
        }
        await interaction.replyHandler.reply(
            `**[${escapeMarkdown(player.queue.current.info.title)}](${
                player.queue.current.info.uri
            })**\n${bar}${player.paused ? ' ⏸️' : ''}${
                player.queue.loop.type !== LoopType.None
                    ? ` ${
                          player.queue.loop.type === LoopType.Queue
                              ? '🔁'
                              : '🔂'
                      }`
                    : ''
            }${player.bassboost ? ' 🅱️' : ''}${
                player.nightcore ? ' 🇳' : ''
            }\n\`[${elapsedString} / ${durationString}]\` | ${await getGuildLocaleString(
                interaction.guildId,
                'MISC.ADDED_BY',
                player.queue.current.requesterId,
            )}`,
            { ephemeral: true },
        );
    },
};
