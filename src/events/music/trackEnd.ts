import { MessageOptionsBuilderType } from '#src/lib';
import { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import {
    getTrackMarkdownLocaleString,
    type QuaverQueue,
    type QuaverSong,
} from '#src/lib/util';
import { LoopType } from '@lavaclient/plugin-queue';
import type { Collection, GuildMember, Snowflake } from 'discord.js';

export default {
    name: 'trackEnd',
    once: false,
    async execute(
        queue: QuaverQueue,
        track: QuaverSong,
        reason: 'cleanup' | 'finished' | 'loadFailed' | 'replaced' | 'stopped',
    ): Promise<void> {
        const guild = await QuaverGuild.wrap(queue.player.guild);
        delete queue.player.memory.skip;
        if (reason === 'loadFailed') {
            logger.warn(`[G ${guild.id}] Track skipped as it failed to load`);
            await queue.player.sendMessage(
                guild.locale(
                    'MUSIC.PLAYER.TRACK_SKIPPED_ERROR',
                    getTrackMarkdownLocaleString(track),
                ),
                { type: MessageOptionsBuilderType.Warning },
            );
            if (!queue.player.memory.failureCount) {
                queue.player.memory.failureCount = 0;
            }
            queue.player.memory.failureCount++;
            if (queue.player.memory.failureCount >= 3) {
                await queue.player.clearQueue();
                await queue.skip();
                await queue.start();
                await queue.player.sendMessage(
                    guild.locale('MUSIC.PLAYER.QUEUE_CLEARED_ERROR'),
                    { type: MessageOptionsBuilderType.Warning },
                );
            }
            return;
        }
        switch (queue.loop.type) {
            case LoopType.Song:
                if (track.info.length <= 15 * 1000) {
                    queue.setLoop(LoopType.None);
                    await queue.player.sendMessage(
                        guild.locale('MUSIC.PLAYER.LOOP_TRACK_DISABLED'),
                        { type: MessageOptionsBuilderType.Warning },
                    );
                    await queue.skip();
                    await queue.start();
                }
                break;
            case LoopType.Queue: {
                if (
                    queue.tracks.reduce(
                        (a: number, b: QuaverSong): number => a + b.info.length,
                        track.info.length,
                    ) <=
                    15 * 1000
                ) {
                    queue.setLoop(LoopType.None);
                    await queue.player.sendMessage(
                        guild.locale('MUSIC.PLAYER.LOOP_QUEUE_DISABLED'),
                        { type: MessageOptionsBuilderType.Warning },
                    );
                    break;
                }
                const transformsActive =
                    queue.player.memory.shuffle ||
                    queue.player.memory.alternate;
                if (transformsActive) {
                    if (queue.player.memory.originalQueue) {
                        queue.player.memory.originalQueue.push(track);
                    }
                    if (queue.player.memory.shuffledQueue) {
                        queue.player.memory.shuffledQueue.push(track.id);
                    }
                }
            }
        }
        if (queue.player.memory.failureCount) {
            delete queue.player.memory.failureCount;
        }
        const members = guild.channels.cache.get(queue.player.voice.channelId)
            .members as Collection<Snowflake, GuildMember>;
        if (
            members?.filter((m): boolean => !m.user.bot).size < 1 &&
            !(await guild.settings.get<boolean>('stay.enabled'))
        ) {
            logger.info(`[G ${guild.id} Disconnecting (alone)`);
            await queue.player.sendMessage(
                guild.locale('MUSIC.DISCONNECT.ALONE.DISCONNECTED.DEFAULT'),
                { type: MessageOptionsBuilderType.Warning },
            );
            await queue.player.disconnect();
        }
    },
};
