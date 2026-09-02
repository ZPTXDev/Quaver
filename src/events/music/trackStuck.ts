import { MessageOptionsBuilderType } from '#src/lib';
import { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import type { QuaverPlayer } from '#src/lib/music';
import { getTrackMarkdownLocaleString } from '#src/lib/util';

export default {
    name: 'trackStuck',
    once: false,
    async execute(player: QuaverPlayer, data: { thresholdMs: number }): Promise<void> {
        const guild = await QuaverGuild.wrap(player.guild);
        const showArtist = (await guild.settings.get<boolean>('showartist')) ?? true;

        logger.warn(
            `[G ${guild.id}] Track stuck (threshold: ${data.thresholdMs}ms) - attempting recovery`,
        );

        if (!player.queue.current) {
            logger.warn(`[G ${guild.id}] No current track to recover, skipping`);
            return;
        }

        const currentTrack = player.queue.current;
        const currentPosition = player.position || 0;

        // Try to recover by re-playing the track from the current position
        try {
            logger.info(
                `[G ${guild.id}] Attempting to recover stuck track at position ${currentPosition}ms`,
            );

            // Stop the stuck track
            await player.stop();

            // Re-play the track from the last known position
            await player.play(currentTrack);

            // Seek to the position where it got stuck (with a small buffer back)
            if (currentPosition > 5000) {
                await player.seek(currentPosition - 5000);
            } else if (currentPosition > 0) {
                await player.seek(currentPosition);
            }

            logger.info(`[G ${guild.id}] Successfully recovered stuck track`);
        } catch (error) {
            // Recovery failed - skip to next track
            logger.error(
                `[G ${guild.id}] Failed to recover stuck track, skipping:`,
                error,
            );

            await player.sendMessage(
                guild.locale(
                    'MUSIC.PLAYER.TRACK_SKIPPED_ERROR',
                    getTrackMarkdownLocaleString(currentTrack, showArtist),
                ),
                { type: MessageOptionsBuilderType.Warning },
            );

            // Skip to next track
            await player.queue.skip();
            await player.queue.start(true);
        }
    },
};
