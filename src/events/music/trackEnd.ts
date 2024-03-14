import type { QuaverQueue, QuaverSong } from '#src/lib/util/common.d.js';
import {
    MessageOptionsBuilderType,
    data,
    logger,
} from '#src/lib/util/common.js';
import { LoopType } from '@lavaclient/plugin-queue';
import type { Collection, GuildMember, Snowflake } from 'discord.js';
import { escapeMarkdown } from 'discord.js';

export default {
    name: 'trackEnd',
    once: false,
    async execute(
        queue: QuaverQueue,
        track: QuaverSong,
        reason:
            | 'PLAYLIST_LOADED'
            | 'TRACK_LOADED'
            | 'SEARCH_RESULT'
            | 'NO_MATCHES'
            | 'LOAD_FAILED',
    ): Promise<void> {
        const { bot } = await import('#src/main.js');
        delete queue.player.skip;
        if (reason === 'LOAD_FAILED') {
            logger.warn({
                message: `[G ${queue.player.id}] Track skipped with reason: ${reason}`,
                label: 'Quaver',
            });
            await queue.player.handler.locale(
                'MUSIC.PLAYER.TRACK_SKIPPED_ERROR',
                {
                    vars: [
                        escapeMarkdown(track.info.title),
                        track.info.uri,
                        reason,
                    ],
                    type: MessageOptionsBuilderType.Warning,
                },
            );
            if (!queue.player.failed) queue.player.failed = 0;
            queue.player.failed++;
            if (queue.player.failed >= 3) {
                queue.clear();
                await queue.skip();
                await queue.start();
                await queue.player.handler.locale(
                    'MUSIC.PLAYER.QUEUE_CLEARED_ERROR',
                );
            }
            return;
        }
        switch (queue.loop.type) {
            case LoopType.Song:
                if (track.info.length <= 15 * 1000) {
                    queue.setLoop(LoopType.None);
                    await queue.player.handler.locale(
                        'MUSIC.PLAYER.LOOP_TRACK_DISABLED',
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
                    await queue.player.handler.locale(
                        'MUSIC.PLAYER.LOOP_QUEUE_DISABLED',
                    );
                }
        }
        if (queue.player.failed) delete queue.player.failed;
        const members = bot.guilds.cache
            .get(queue.player.id)
            .channels.cache.get(queue.player.voice.channelId)
            .members as Collection<Snowflake, GuildMember>;
        if (
            members?.filter((m): boolean => !m.user.bot).size < 1 &&
            !(await data.guild.get(queue.player.id, 'settings.stay.enabled'))
        ) {
            logger.info({
                message: `[G ${queue.player.id}] Disconnecting (alone)`,
                label: 'Quaver',
            });
            await queue.player.handler.locale(
                'MUSIC.DISCONNECT.ALONE.DISCONNECTED.DEFAULT',
                { type: MessageOptionsBuilderType.Warning },
            );
            await queue.player.handler.disconnect();
        }
    },
};
