import { MessageOptionsBuilderType } from '#src/lib';
import { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import type { QuaverQueue } from '#src/lib/util';

export default {
    name: 'queueFinish',
    once: false,
    async execute(queue: QuaverQueue): Promise<void> {
        const guild = await QuaverGuild.wrap(queue.player.guild);
        if (await guild.settings.get<boolean>('stay.enabled')) {
            await queue.player.sendMessage(guild.locale('MUSIC.QUEUE.EMPTY'));
            return;
        }
        // rare case where the client sets timeout after setting pause timeout
        if (queue.player.timeout.pause) return;
        logger.info(`[G ${guild.id}] Setting timeout`);
        if (queue.player.timeout.standard) {
            clearTimeout(queue.player.timeout.standard);
        }
        queue.player.timeout.standard = setTimeout(
            (p, g): void => {
                logger.info(`[G ${g.id}] Disconnecting (inactivity)`);
                p.sendMessage(
                    g.locale('MUSIC.DISCONNECT.INACTIVITY.DISCONNECTED'),
                    {
                        type: MessageOptionsBuilderType.Warning,
                    },
                );
                p.disconnect();
            },
            30 * 60 * 1000,
            queue.player,
            guild,
        );
        queue.player.timeout.end = Date.now() + 30 * 60 * 1000;
        guild.sendWebUpdate('timeoutUpdate', queue.player.timeout.end);
        await queue.player.sendMessage(
            `${guild.locale('MUSIC.QUEUE.EMPTY')} ${guild.locale(
                'MUSIC.DISCONNECT.INACTIVITY.WARNING',
                (Math.floor(Date.now() / 1000) + 30 * 60).toString(),
            )}`,
            { type: MessageOptionsBuilderType.Warning },
        );
    },
};
