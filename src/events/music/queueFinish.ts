import type { QuaverQueue } from '#src/lib/util/common.d.js';
import {
    data,
    logger,
    MessageOptionsBuilderType,
} from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString } from '#src/lib/util/util.js';

export default {
    name: 'queueFinish',
    once: false,
    async execute(queue: QuaverQueue): Promise<void> {
        const { io } = await import('#src/main.js');
        if (await data.guild.get(queue.player.id, 'settings.stay.enabled')) {
            await queue.player.handler.locale('MUSIC.QUEUE.EMPTY');
            return;
        }
        // rare case where the bot sets timeout after setting pause timeout
        if (queue.player.pauseTimeout) return;
        logger.info({
            message: `[G ${queue.player.id}] Setting timeout`,
            label: 'Quaver',
        });
        if (queue.player.timeout) clearTimeout(queue.player.timeout);
        queue.player.timeout = setTimeout(
            (p): void => {
                logger.info({
                    message: `[G ${p.id}] Disconnecting (inactivity)`,
                    label: 'Quaver',
                });
                p.handler.locale('MUSIC.DISCONNECT.INACTIVITY.DISCONNECTED', {
                    type: MessageOptionsBuilderType.Warning,
                });
                p.handler.disconnect();
            },
            30 * 60 * 1000,
            queue.player,
        );
        queue.player.timeoutEnd = Date.now() + 30 * 60 * 1000;
        if (settings.features.web.enabled) {
            io.to(`guild:${queue.player.id}`).emit(
                'timeoutUpdate',
                queue.player.timeoutEnd,
            );
        }
        await queue.player.handler.send(
            `${await getGuildLocaleString(
                queue.player.id,
                'MUSIC.QUEUE.EMPTY',
            )} ${await getGuildLocaleString(
                queue.player.id,
                'MUSIC.DISCONNECT.INACTIVITY.WARNING',
                (Math.floor(Date.now() / 1000) + 30 * 60).toString(),
            )}`,
            { type: MessageOptionsBuilderType.Warning },
        );
    },
};
