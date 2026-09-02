import { MessageOptionsBuilderType } from '#src/lib';
import { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import type { QuaverPlayer } from '#src/lib/music';
import { getTrackMarkdownLocaleString } from '#src/lib/util';

export default {
    name: 'trackException',
    once: false,
    async execute(
        player: QuaverPlayer,
        data: { exception: { message: string; severity: string; cause: string } },
    ): Promise<void> {
        const guild = await QuaverGuild.wrap(player.guild);
        const showArtist = (await guild.settings.get<boolean>('showartist')) ?? true;

        logger.error(
            `[G ${guild.id}] Track exception: ${data.exception.severity} - ${data.exception.message} (${data.exception.cause})`,
        );

        if (!player.queue.current) {
            logger.warn(`[G ${guild.id}] No current track during exception, skipping`);
            return;
        }

        const currentTrack = player.queue.current;
        const currentPosition = player.position || 0;

        // Check if this is a recoverable error (e.g., timeout, network issue)
        const isRecoverable =
            data.exception.cause === 'java.net.SocketTimeoutException' ||
            data.exception.cause === 'java.io.IOException' ||
            data.exception.message.includes('timeout') ||
            data.exception.message.includes('timed out') ||
            (data.exception.severity === 'COMMON' && currentPosition > 10000);

        if (isRecoverable) {
            // Try to recover by re-playing the track from the current position
            try {
                logger.info(
                    `[G ${guild.id}] Attempting to recover from exception at position ${currentPosition}ms`,
                );

                // Stop the failed track
                await player.stop();

                // Re-play the track from the last known position
                await player.play(currentTrack);

                // Seek to the position where it failed (with a small buffer back)
                if (currentPosition > 5000) {
                    await player.seek(currentPosition - 5000);
                } else if (currentPosition > 0) {
                    await player.seek(currentPosition);
                }

                logger.info(`[G ${guild.id}] Successfully recovered from exception`);
                return;
            } catch (error) {
                logger.error(
                    `[G ${guild.id}] Failed to recover from exception:`,
                    error,
                );
            }
        }

        // Non-recoverable error or recovery failed - skip to next track
        await player.sendMessage(
            guild.locale(
                'MUSIC.PLAYER.TRACK_SKIPPED_ERROR',
                getTrackMarkdownLocaleString(currentTrack, showArtist),
            ),
            { type: MessageOptionsBuilderType.Warning },
        );

        player.memory.failureCount = (player.memory.failureCount || 0) + 1;

        if (player.memory.failureCount >= 3) {
            await player.clearQueue();
            await player.sendMessage(
                guild.locale('MUSIC.PLAYER.QUEUE_CLEARED_ERROR'),
                { type: MessageOptionsBuilderType.Warning },
            );
        }

        // Skip to next track
        await player.queue.skip();
        await player.queue.start(true);
    },
};
