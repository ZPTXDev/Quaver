import { LoopType } from '@lavaclient/plugin-queue';
import type { Collection, GuildMember, Snowflake } from 'discord.js';
import { QuaverGuild } from '#src/lib';
import { logger, MessageOptionsBuilderType } from '#src/lib/util/common';
import type { QuaverQueue, QuaverSong } from '#src/lib/util/common.d';
import { getTrackMarkdownLocaleString } from '#src/lib/util/util';

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
            logger.warn({
                message: `[G ${guild.id}] Track skipped as it failed to load`,
                label: 'Quaver',
            });
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
                queue.clear();
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
            case LoopType.Queue:
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
            logger.info({
                message: `[G ${guild.id} Disconnecting (alone)`,
                label: 'Quaver',
            });
            await queue.player.sendMessage(
                guild.locale('MUSIC.DISCONNECT.ALONE.DISCONNECTED.DEFAULT'),
                { type: MessageOptionsBuilderType.Warning },
            );
            await queue.player.disconnect();
        }
    },
};
