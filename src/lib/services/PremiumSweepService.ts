import { QuaverGuild } from '#src/lib/guild';
import { MessageOptionsBuilderType } from '#src/lib';
import { logger } from '#src/lib/logger';
import { LocaleKey } from '../locales';

export class PremiumSweepService {
    private interval: ReturnType<typeof setInterval> | null = null;

    start(): void {
        if (this.interval) return;

        logger.info('Starting Premium/Whitelist expiration sweep service at 15m interval');

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
                try {
                    const guild = await QuaverGuild.wrap(player.guild);

                    // 1. Check stay (24/7) feature
                    const staySetting = await guild.settings.get<boolean>('stay.enabled');
                    const isStayActive = await guild.features.isFeatureActive('stay');

                    if (staySetting && !isStayActive) {
                        logger.info(`[G ${guild.id}] Premium or 24/7 Mode whitelist expired. Disconnecting immediately.`);
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
                            logger.info(`[G ${guild.id}] Premium or Smart Queue whitelist expired. Deactivating feature.`);
                            await player.setAlternate(false);
                            await player.sendMessage(
                                guild.locale(`MUSIC.PLAYER.FEATURE_DISABLED.SMARTQUEUE.${isPremium ? 'PREMIUM' : 'WHITELIST'}` as LocaleKey),
                                { type: MessageOptionsBuilderType.Warning }
                            );
                        }
                    }
                } catch (playerError) {
                    logger.error(`Error processing premium sweep for player of guild ${player.guild.id}:`, playerError);
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
