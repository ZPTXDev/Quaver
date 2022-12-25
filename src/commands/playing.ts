import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import { LoopType } from '@lavaclient/queue';
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
        const player = interaction.client.music.players.get(
            interaction.guildId,
        ) as QuaverPlayer;
        // workaround: seems like current track doesn't get removed after the track, an issue with @lavaclient/queue
        if (!player.queue.current || (!player.playing && !player.paused)) {
            await interaction.replyHandler.locale(
                'MUSIC.PLAYER.PLAYING.NOTHING',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const bar = getBar(
            (player.position / player.queue.current.length) * 100,
        );
        let elapsed = msToTime(player.position);
        if (isNaN(elapsed['s']) || elapsed['s'] < 0) {
            elapsed = { d: 0, h: 0, m: 0, s: 0 };
        }
        const elapsedString = msToTimeString(elapsed, true);
        const duration = msToTime(player.queue.current.length);
        const durationString = msToTimeString(duration, true);
        if (player.queue.current.isStream) {
            await interaction.replyHandler.reply(
                `**[${escapeMarkdown(player.queue.current.title)}](${
                    player.queue.current.uri
                })**\n🔴 **${await getGuildLocaleString(
                    interaction.guildId,
                    'MISC.LIVE',
                )}** ${'▬'.repeat(10)}${player.paused ? ' ⏸️' : ''}${
                    player.queue.loop.type !== LoopType.None
                        ? ` ${
                              player.queue.loop.type === LoopType.Queue
                                  ? '🔁'
                                  : '🔂'
                          }`
                        : ''
                }${
                    player.bassboost ? ' 🅱️' : ''
                }\n\`[${await getGuildLocaleString(
                    interaction.guildId,
                    'MISC.STREAMING',
                )}]\` | ${await getGuildLocaleString(
                    interaction.guildId,
                    'MISC.ADDED_BY',
                    player.queue.current.requester,
                )}`,
                { ephemeral: true },
            );
            return;
        }
        await interaction.replyHandler.reply(
            `**[${escapeMarkdown(player.queue.current.title)}](${
                player.queue.current.uri
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
                player.queue.current.requester,
            )}`,
            { ephemeral: true },
        );
    },
};
