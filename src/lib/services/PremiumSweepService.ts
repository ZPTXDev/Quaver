import type { Initialized } from '#src/lib/guild';
import { QuaverGuild } from '#src/lib/guild';
import type { QuaverClient } from '#src/lib';
import { MessageOptionsBuilderType } from '#src/lib';
import { logger } from '#src/lib/logger';
import { type QuaverChannels, settings } from '#src/lib/util';
import type { LocaleKey } from '../locales';
import type { QuaverPlayer } from '../music';
import type { Guild } from 'discord.js';

export class PremiumSweepService {
    private interval: ReturnType<typeof setInterval> | null = null;
    private bootSweepTimeout: ReturnType<typeof setTimeout> | null = null;

    start(): void {
        if (this.interval) return;

        logger.info('Starting Premium/Whitelist expiration sweep service at 15m interval');

        // Run initial sweep on boot after a short delay (e.g. 10 seconds) to let guilds load
        this.bootSweepTimeout = setTimeout((): void => {
            void this.sweep();
            this.bootSweepTimeout = null;
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
                        // Check if there are any users in the voice channel (excluding bots)
                        const voiceChannelId = player.voice.channelId;
                        const voiceChannel = voiceChannelId ? guild.channels.cache.get(voiceChannelId) : null;
                        
                        let hasUsers = false;
                        if (voiceChannel && 'members' in voiceChannel && voiceChannel.members instanceof Map) {
                            hasUsers = Array.from(voiceChannel.members.values()).some((member): boolean => !member.user.bot);
                        }

                        if (!hasUsers) {
                            // No users in channel - disconnect immediately
                            logger.info(`[G ${guild.id}] Premium or 24/7 Mode whitelist expired. Disconnecting immediately.`);
                            const isStayPremium = !!(settings.premiumURL && settings.features.stay.premium);
                            await player.sendMessage(
                                guild.locale(isStayPremium ? 'MUSIC.SESSION_ENDED.FORCED.PREMIUM_EXPIRED' : 'MUSIC.SESSION_ENDED.FORCED.WHITELIST_EXPIRED' as LocaleKey),
                                { type: MessageOptionsBuilderType.Warning }
                            );
                            await player.disconnect();
                            continue;
                        } else {
                            // Users are present - disable stay setting but keep session active
                            await guild.settings.set('stay.enabled', false);
                            logger.info(`[G ${guild.id}] Premium or 24/7 Mode whitelist expired. Disabled 24/7 mode but keeping session active due to users in channel.`);
                            // Let normal timeout logic handle disconnection when users leave
                        }
                    }

                    // 2. Check smart queue (alternating) feature
                    if (player.memory.alternate) {
                        const isSmartQueueActive = await guild.features.isFeatureActive('smartqueue');
                        if (!isSmartQueueActive) {
                            logger.info(`[G ${guild.id}] Premium or Smart Queue whitelist expired. Deactivating feature.`);
                            await player.setAlternate(false);
                            const isSmartQueuePremium = !!(settings.premiumURL && settings.features.smartqueue.premium);
                            await player.sendMessage(
                                guild.locale(`MUSIC.PLAYER.FEATURE_DISABLED.SMARTQUEUE.${isSmartQueuePremium ? 'PREMIUM' : 'WHITELIST'}` as LocaleKey),
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

    /**
     * Re-enables premium-gated features for a guild after premium has been added or renewed.
     * If an active player session exists, restores features in-session.
     * If no session exists but 24/7 Mode was enabled, reconnects to the saved voice channel.
     * @param guildId - The ID of the guild to restore features for.
     */
    static async restoreFeatures(guildId: string): Promise<void> {
        try {
            const { client } = await import('#src/main');
            const discordGuild = client.guilds.cache.get(guildId);
            if (!discordGuild) return;

            const guild = await QuaverGuild.wrap(discordGuild);
            const player = client.music?.players?.cache.get(guildId);

            if (player) {
                await this.restoreActiveSessionFeatures(player, guild, guildId);
            } else {
                await this.reconnectStayChannel(client, guild, guildId);
            }
        } catch (error) {
            logger.error(`Error restoring features for guild ${guildId} after premium renewal:`, error);
        }
    }

    /**
     * Restores premium features for an active player session.
     */
    private static async restoreActiveSessionFeatures(
        player: QuaverPlayer,
        guild: QuaverGuild<Initialized> & Guild,
        guildId: string
    ): Promise<void> {
        const isStayPremium = !!(settings.premiumURL && settings.features.stay.premium);
        const isSmartQueuePremium = !!(settings.premiumURL && settings.features.smartqueue.premium);

        // 1. Re-enable 24/7 (stay) if it was previously enabled but got cut off
        const staySetting = await guild.settings.get<boolean>('stay.enabled');
        const isStayNowActive = await guild.features.isFeatureActive('stay');
        if (staySetting && isStayNowActive) {
            logger.info(`[G ${guildId}] Premium restored. Re-activating 24/7 Mode.`);
            if (player.timeout.standard) {
                clearTimeout(player.timeout.standard);
                delete player.timeout.standard;
                guild.sendWebUpdate('timeoutUpdate', false);
            }
            await player.sendMessage(
                guild.locale(`MUSIC.PLAYER.FEATURE_RESTORED.STAY.${isStayPremium ? 'PREMIUM' : 'WHITELIST'}` as LocaleKey),
                { type: MessageOptionsBuilderType.Success }
            );
        }

        // 2. Re-enable Smart Queue if it was previously enabled but got deactivated
        const smartQueueSetting = await guild.settings.get<boolean>('smartqueue');
        const isSmartQueueNowActive = await guild.features.isFeatureActive('smartqueue');
        if (smartQueueSetting && isSmartQueueNowActive && !player.memory.alternate) {
            logger.info(`[G ${guildId}] Premium restored. Re-activating Smart Queue.`);
            await player.setAlternate(true);
            await player.sendMessage(
                guild.locale(`MUSIC.PLAYER.FEATURE_RESTORED.SMARTQUEUE.${isSmartQueuePremium ? 'PREMIUM' : 'WHITELIST'}` as LocaleKey),
                { type: MessageOptionsBuilderType.Success }
            );
        }
    }

    /**
     * Reconnects to the stay channel if 24/7 Mode was enabled but no active session exists.
     */
    private static async reconnectStayChannel(
        client: QuaverClient,
        guild: QuaverGuild<Initialized> & Guild,
        guildId: string
    ): Promise<void> {
        const staySetting = await guild.settings.get<boolean>('stay.enabled');
        const isStayNowActive = await guild.features.isFeatureActive('stay');
        if (!staySetting || !isStayNowActive) return;

        const stayChannel = await guild.settings.get<string>('stay.channel');
        const stayText = await guild.settings.get<string>('stay.text');
        if (!stayChannel || !stayText) return;

        logger.info(`[G ${guildId}] Premium restored. Reconnecting to stay channel.`);
        const isStayPremium = !!(settings.premiumURL && settings.features.stay.premium);
        const newPlayer = client.music.players.create(guild);
        newPlayer.queue.channel = guild.channels.cache.get(stayText) as QuaverChannels;
        newPlayer.voice.connect(stayChannel, { deafened: true });
        await newPlayer.sendMessage(
            guild.locale(`MUSIC.PLAYER.FEATURE_RESTORED.STAY.${isStayPremium ? 'PREMIUM' : 'WHITELIST'}` as LocaleKey),
            { type: MessageOptionsBuilderType.Success }
        );
    }

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        if (this.bootSweepTimeout) {
            clearTimeout(this.bootSweepTimeout);
            this.bootSweepTimeout = null;
        }
    }
}
