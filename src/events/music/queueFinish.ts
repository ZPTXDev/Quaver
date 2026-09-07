import { MessageOptionsBuilderType } from '#src/lib';
import { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import { AutoplayService } from '#src/lib/services/AutoplayService';
import { updateHandler } from '#src/lib/state';
import type { QuaverQueue } from '#src/lib/util';
import { settings } from '#src/lib/util';
import { ContainerBuilder } from 'discord.js';

export default {
    name: 'queueFinish',
    once: false,
    async execute(queue: QuaverQueue): Promise<void> {
        const guild = await QuaverGuild.wrap(queue.player.guild);
        queue.player.logSessionEvent('QUEUE_FINISH');
        if (updateHandler.restartInProgress) {
            await queue.player.sendMessage(
                new ContainerBuilder().addTextDisplayComponents(
                    guild.builders.textDisplayLocale(
                        'MUSIC.PLAYER.RESTARTING.PENDING',
                    ),
                    guild.builders.textDisplayLocale(
                        settings.sessionRecovery?.enabled
                            ? 'MUSIC.PLAYER.RESTARTING.SESSION_RECOVERY_EXPLANATION'
                            : 'MUSIC.PLAYER.RESTARTING.SESSION_RECOVERY_DISABLED',
                    ),
                    guild.builders.textDisplayLocale(
                        'MUSIC.PLAYER.RESTARTING.APOLOGY',
                    ),
                ),
                { type: MessageOptionsBuilderType.Warning },
            );
            return;
        }

        // Check if autoplay is enabled and active
        const autoplayEnabled = await guild.settings.get<boolean>('autoplay');
        const isAutoplayFeatureActive = await guild.features.isFeatureActive('autoplay');

        if (autoplayEnabled && isAutoplayFeatureActive) {
            logger.info(`[G ${guild.id}] Queue finished, attempting to start autoplay`);

            try {
                // Get the seed track (last played track)
                const seedTrack = queue.player.queue.last;

                if (!seedTrack || queue.player.isAdTrack(seedTrack)) {
                    logger.warn(`[G ${guild.id}] No valid seed track for autoplay`);
                    // Fall through to normal timeout behavior
                } else {
                    // Build history from previous tracks for deduplication
                    const history = queue.player.memory.autoplayHistory || [];
                    if (seedTrack) {
                        history.push(seedTrack);
                    }

                    // Generate recommendations
                    const recommendations = await AutoplayService.generateRecommendations(
                        queue.player.client,
                        guild,
                        seedTrack,
                        history,
                    );

                    if (recommendations.length > 0) {
                        logger.info(
                            `[G ${guild.id}] Generated ${recommendations.length} autoplay recommendations`,
                        );

                        // Store autoplay queue and mark as active
                        queue.player.memory.autoplayQueue = recommendations;
                        queue.player.memory.autoplayHistory = history;
                        queue.player.memory.isAutoplayActive = true;

                        // Add first track to queue and start playing
                        queue.add(recommendations[0]);
                        queue.player.memory.autoplayQueue.shift();

                        // Cancel any existing timeout
                        if (queue.player.timeout.standard) {
                            clearTimeout(queue.player.timeout.standard);
                            queue.player.timeout.standard = undefined;
                            queue.player.timeout.end = undefined;
                        }

                        await queue.player.sendMessage(
                            guild.locale('MUSIC.AUTOPLAY.STARTED'),
                            { type: MessageOptionsBuilderType.Success },
                        );

                        queue.player.logSessionEvent('AUTOPLAY_START', null, `${recommendations.length} tracks queued`);

                        // Start playing
                        await queue.start();
                        guild.sendWebUpdate('queueUpdate', queue.player.decorateQueue());
                        return;
                    } else {
                        logger.warn(`[G ${guild.id}] No autoplay recommendations generated`);
                    }
                }
            } catch (error) {
                logger.error(`[G ${guild.id}] Autoplay failed:`, error);
                // Fall through to normal timeout behavior
            }
        }

        // Original behavior: 24/7 or disconnect timeout
        if (await guild.settings.get<boolean>('stay.enabled') && await guild.features.isFeatureActive('stay')) {
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
        guild.sendWebUpdate('queueUpdate', queue.player.decorateQueue());
        await queue.player.sendMessage(
            `${guild.locale('MUSIC.QUEUE.EMPTY')} ${guild.locale(
                'MUSIC.DISCONNECT.INACTIVITY.WARNING',
                (Math.floor(Date.now() / 1000) + 30 * 60).toString(),
            )}`,
            { type: MessageOptionsBuilderType.Warning },
        );
    },
};
