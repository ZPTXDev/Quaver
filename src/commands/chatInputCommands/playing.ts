import { LoopType } from '@lavaclient/plugin-queue';
import { getBar, msToTime, msToTimeString } from '@zptxdev/zptx-lib';
import { escapeMarkdown, SlashCommandBuilder } from 'discord.js';
import { QuaverGuild } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { MessageOptionsBuilderType } from '#src/lib/util/common';
import { Check } from '#src/lib/util/constants';
import { settings } from '#src/lib/util/settings';
import { cleanURIForMarkdown, getLocaleString } from '#src/lib/util/util';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('playing')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.PLAYING.DESCRIPTION',
                ),
            ),
    )
    .setChecks([
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ])
    .setExecute(async function(interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        // workaround: seems like current track doesn't get removed after the track, an issue with @lavaclient/queue
        if (!player.queue.current || (!player.playing && !player.paused)) {
            await interaction.replyHandler.reply(
                guild.locale('MUSIC.PLAYER.PLAYING.NOTHING'),
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
            elapsedString = guild.locale('MISC.MORE_THAN_A_DAY');
        }
        const duration = msToTime(player.queue.current.info.length);
        let durationString = msToTimeString(duration, true);
        if (durationString === 'MORE_THAN_A_DAY') {
            durationString = guild.locale('MISC.MORE_THAN_A_DAY');
        }
        if (player.queue.current.info.isStream) {
            await interaction.replyHandler.reply(
                `${
                    player.queue.current.info.title ===
                    player.queue.current.info.uri
                        ? `**${player.queue.current.info.uri}**`
                        : `[**${escapeMarkdown(cleanURIForMarkdown(player.queue.current.info.title))}**](${player.queue.current.info.uri})`
                }\n🔴 **${guild.locale(
                    'MISC.LIVE',
                )}** ${'▬'.repeat(10)}${player.paused ? ' ⏸️' : ''}${
                    player.queue.loop.type !== LoopType.None
                        ? ` ${
                              player.queue.loop.type === LoopType.Queue
                                  ? '🔁'
                                  : '🔂'
                          }`
                        : ''
                }${player.memory.bassboost ? ' 🅱️' : ''}\n\`[${guild.locale(
                    'MISC.STREAMING',
                )}]\` | ${guild.locale(
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
            }${player.memory.bassboost ? ' 🅱️' : ''}${
                player.memory.nightcore ? ' 🇳' : ''
            }\n\`[${elapsedString} / ${durationString}]\` | ${guild.locale(
                'MISC.ADDED_BY',
                player.queue.current.requesterId,
            )}`,
            { ephemeral: true },
        );
    });
