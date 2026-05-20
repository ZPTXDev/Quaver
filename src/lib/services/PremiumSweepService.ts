import { QuaverGuild } from '#src/lib/guild';
import { MessageOptionsBuilderType } from '#src/lib';
import { logger } from '#src/lib/logger';

export class PremiumSweepService {
    private interval: ReturnType<typeof setInterval> | null = null;

    start(): void {
        if (this.interval) return;

        logger.info('Starting Premium/Whitelist Expiration Sweep Service (15m interval)...');

        // Run initial sweep on boot after a short delay (e.g. 10 seconds) to let guilds load
        setTimeout((): void => {
            void this.sweep();
        }, 10 * 1000);

        this.interval = setInterval((): void => {
            void this.sweep();
        }, 15 * 60 * 1000);
    }

    async sweep(): Promise<void> {
        try {
            const { client } = await import('#src/main');
            if (!client.music?.players?.cache) return;
            for (const player of client.music.players.cache.values()) {
                const guild = await QuaverGuild.wrap(player.guild);

                // 1. Check stay (24/7) feature
                const staySetting = await guild.settings.get<boolean>('stay.enabled');
                const isStayActive = await guild.features.isFeatureActive('stay');

                if (staySetting && !isStayActive) {
                    logger.info(`[G ${guild.id}] Stay premium/whitelist expired. Disconnecting immediately.`);
                    await player.sendMessage(
                        guild.locale('MUSIC.SESSION_ENDED.FORCED.PREMIUM_EXPIRED'),
                        { type: MessageOptionsBuilderType.Warning }
                    );
                    await player.disconnect();
                    continue;
                }

                // 2. Check smart queue (alternating) feature
                if (player.memory.alternate) {
                    const isSmartQueueActive = await guild.features.isFeatureActive('smartqueue');
                    if (!isSmartQueueActive) {
                        logger.info(`[G ${guild.id}] Smart Queue premium/whitelist expired. Deactivating feature.`);
                        await player.setAlternate(false);
                        await player.sendMessage(
                            guild.locale('MUSIC.SESSION_ENDED.FORCED.PREMIUM_EXPIRED_FEATURES'),
                            { type: MessageOptionsBuilderType.Warning }
                        );
                    }
                }
            }
        } catch (error) {
            logger.error('Error in PremiumSweepService sweep execution:', error);
        }
    }

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}
