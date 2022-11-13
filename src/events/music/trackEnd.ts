import type { QuaverQueue, QuaverSong } from '#src/lib/util/common.d.js';
import {
    data,
    logger,
    MessageOptionsBuilderType,
} from '#src/lib/util/common.js';
import { LoopType } from '@lavaclient/queue';
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
                message: `[G ${queue.player.guildId}] Track skipped with reason: ${reason}`,
                label: 'Quaver',
            });
            await queue.player.handler.locale(
                'MUSIC.PLAYER.TRACK_SKIPPED_ERROR',
                {
                    vars: [escapeMarkdown(track.title), track.uri, reason],
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
                if (track.length <= 15 * 1000) {
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
                        (a: number, b: QuaverSong): number => a + b.length,
                        track.length,
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
            .get(queue.player.guildId)
            .channels.cache.get(queue.player.channelId).members as Collection<
            Snowflake,
            GuildMember
        >;
        if (
            members?.filter((m): boolean => !m.user.bot).size < 1 &&
            !(await data.guild.get(
                queue.player.guildId,
                'settings.stay.enabled',
            ))
        ) {
            logger.info({
                message: `[G ${queue.player.guildId}] Disconnecting (alone)`,
                label: 'Quaver',
            });
            await queue.player.handler.locale(
                'MUSIC.DISCONNECT.ALONE.DISCONNECTED.DEFAULT',
                { type: MessageOptionsBuilderType.Warning },
            );
            return queue.player.handler.disconnect();
        }
    },
};
