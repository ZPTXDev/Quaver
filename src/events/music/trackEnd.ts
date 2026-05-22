import { MessageOptionsBuilderType } from '#src/lib';
import { data } from '#src/lib/data';
import { QuaverGuild, WhitelistStatus } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import { LoopType, type QuaverQueue } from '#src/lib/music';
import {
    getPremiumURL,
    getTrackMarkdownLocaleString,
    type QuaverSong,
    settings,
} from '#src/lib/util';
import type { Collection, GuildMember, Snowflake } from 'discord.js';
import { mayStartNext } from 'lavalink-protocol';

export default {
    name: 'queueTrackEnd',
    once: false,
    async execute(
        queue: QuaverQueue,
        track: QuaverSong,
        reason: 'cleanup' | 'finished' | 'loadFailed' | 'replaced' | 'stopped',
    ): Promise<void> {
        const guild = await QuaverGuild.wrap(queue.player.guild);
        delete queue.player.memory.skip;

        const isAdTrack = queue.player.isAdTrack(track);

        // Handle load failures
        if (reason === 'loadFailed') {
            // If ad failed to load, skip silently
            if (isAdTrack) {
                queue.player.memory.isAdPlaying = false;
                queue.player.memory.adPlaytimeMs = 0;
                await data.guild.set(guild.id, 'ads.playtimeMs', 0);

                // Restore saved filters
                if (queue.player.memory.savedFilters) {
                    // Batch filter updates to prevent UI flickering
                    await queue.player.setBassboost(queue.player.memory.savedFilters.bassboost, true);
                    await queue.player.setNightcore(queue.player.memory.savedFilters.nightcore, true);
                    delete queue.player.memory.savedFilters;
                    
                    // Send single batched web update
                    guild.sendWebUpdate('filterUpdate', {
                        bassboost: queue.player.memory.bassboost,
                        nightcore: queue.player.memory.nightcore,
                    });
                }

                // Advance to next track silently
                await queue.next();
                return;
            }

            // Regular track load failure - show error to user
            logger.warn(`[G ${guild.id}] Track skipped as it failed to load`);
            await queue.player.sendMessage(
                guild.locale(
                    'MUSIC.PLAYER.TRACK_SKIPPED_ERROR',
                    getTrackMarkdownLocaleString(track),
                ),
                { type: MessageOptionsBuilderType.Warning },
            );

            queue.player.memory.failureCount =
                (queue.player.memory.failureCount || 0) + 1;

            if (queue.player.memory.failureCount >= 3) {
                await queue.player.clearQueue();
                await queue.player.sendMessage(
                    guild.locale('MUSIC.PLAYER.QUEUE_CLEARED_ERROR'),
                    { type: MessageOptionsBuilderType.Warning },
                );
            }

            // Advance to next track
            const hasNext = await queue.next();
            if (!hasNext) {
                logger.info(`[G ${guild.id}] Queue finished after load failures`);
            }
            return;
        }

        // If ad just finished, clean up ad state
        if (isAdTrack) {
            queue.player.memory.isAdPlaying = false;
            queue.player.memory.adPlaytimeMs = 0;
            await data.guild.set(guild.id, 'ads.playtimeMs', 0);

            // Restore saved filters
            if (queue.player.memory.savedFilters) {
                // Batch filter updates to prevent UI flickering
                await queue.player.setBassboost(queue.player.memory.savedFilters.bassboost, true);
                await queue.player.setNightcore(queue.player.memory.savedFilters.nightcore, true);
                delete queue.player.memory.savedFilters;
                
                // Send single batched web update
                guild.sendWebUpdate('filterUpdate', {
                    bassboost: queue.player.memory.bassboost,
                    nightcore: queue.player.memory.nightcore,
                });
            }

            // Only advance to next track if the reason warrants it
            if (mayStartNext[reason]) {
                await queue.next();
            }
            return;
        }

        // Accumulate playtime for regular tracks (not ads)
        // Use player position to track actual listened duration, regardless of end reason
        // This prevents users from skipping tracks to avoid ads
        if (reason === 'finished' || reason === 'stopped' || reason === 'replaced') {
            // Initialize playtime from database if not in memory
            if (queue.player.memory.adPlaytimeMs === undefined) {
                const dbPlaytime = await data.guild.get<number>(
                    guild.id,
                    'ads.playtimeMs',
                );
                queue.player.memory.adPlaytimeMs = dbPlaytime || 0;
            }
            
            // Accumulate actual listened duration using player position
            const listenedDuration = queue.player.position || 0;
            queue.player.memory.adPlaytimeMs += listenedDuration;
            await data.guild.set(
                guild.id,
                'ads.playtimeMs',
                queue.player.memory.adPlaytimeMs,
            );
        }

        // Only check for ad insertion when a track finishes naturally
        // (not when user skips, as we don't want to interrupt their action with an ad)
        if (reason === 'finished') {
            const adsConfig = settings.ads;
            const isPremium = await guild.features.checkWhitelisted('premium');

            const shouldPlayAd =
                adsConfig?.enabled &&
                adsConfig.urls.length > 0 &&
                isPremium !== WhitelistStatus.Permanent &&
                isPremium !== WhitelistStatus.Temporary &&
                queue.player.memory.adPlaytimeMs >=
                    adsConfig.intervalMinutes * 60 * 1000;

            if (shouldPlayAd) {
                try {
                    // Select random ad URL
                    const randomIndex = Math.floor(
                        Math.random() * adsConfig.urls.length,
                    );
                    const adUrl = adsConfig.urls[randomIndex];

                    // Load the ad track
                    const result =
                        await queue.player.client.music.api.loadTracks(adUrl);

                    if (result.loadType === 'track' && result.data) {
                        const premiumURL = getPremiumURL(guild.id);
                        const adTrack = {
                            ...result.data,
                            isAd: true,
                            info: {
                                ...result.data.info,
                                title: 'Ad Break',
                                author: 'Quaver',
                                uri: premiumURL || undefined,
                                artworkUrl: queue.player.client.user.displayAvatarURL(),
                            },
                            requesterId: queue.player.client.user.id,
                        } as QuaverSong;

                        // Save current filters and disable them for the ad
                        queue.player.memory.savedFilters = {
                            bassboost: queue.player.memory.bassboost,
                            nightcore: queue.player.memory.nightcore,
                        };
                        
                        // Batch filter updates to prevent UI flickering
                        if (queue.player.memory.bassboost) {
                            await queue.player.setBassboost(false, true);
                        }
                        if (queue.player.memory.nightcore) {
                            await queue.player.setNightcore(false, true);
                        }
                        
                        // Send single batched web update only if filters were changed
                        if (queue.player.memory.savedFilters.bassboost || queue.player.memory.savedFilters.nightcore) {
                            guild.sendWebUpdate('filterUpdate', {
                                bassboost: queue.player.memory.bassboost,
                                nightcore: queue.player.memory.nightcore,
                            });
                        }

                        // Mark that an ad is playing
                        queue.player.memory.isAdPlaying = true;
                        // Save current playtime before resetting (for disconnect handling)
                        queue.player.memory.preAdPlaytimeMs = queue.player.memory.adPlaytimeMs;
                        queue.player.memory.adPlaytimeMs = 0;
                        await data.guild.set(guild.id, 'ads.playtimeMs', 0);

                        // Handle loop logic for the finished track before playing ad
                        // This ensures the track isn't lost from the loop cycle
                        if (queue.loop.type === LoopType.Queue) {
                            // Add finished track to previous array for queue loop
                            queue.previous.push(track);
                            
                            // Handle shuffle/alternate with queue loop
                            const transformsActive =
                                queue.player.memory.shuffle || queue.player.memory.alternate;
                            if (transformsActive) {
                                if (queue.player.memory.originalQueue) {
                                    queue.player.memory.originalQueue.push(track);
                                }
                                if (queue.player.memory.shuffledQueue) {
                                    queue.player.memory.shuffledQueue.push(track.id);
                                }
                            }
                        } else if (queue.loop.type === LoopType.Song) {
                            // For song loop, unshift the track back to the queue
                            // so it will be replayed after the ad finishes
                            // Preserve the loop counter by updating queue.last
                            queue.tracks.unshift(track);
                            queue.last = track;
                        }

                        // Set queue.current to the ad track so trackStart displays it correctly
                        queue.current = adTrack;

                        // Play ad directly (NOT through queue)
                        await queue.player.play(adTrack);
                        // Don't advance queue yet - wait for ad to finish
                        return;
                    } else {
                        // Failed to load ad, reset counter
                        queue.player.memory.adPlaytimeMs = 0;
                        await data.guild.set(guild.id, 'ads.playtimeMs', 0);
                    }
                } catch {
                    // Error loading ad, reset counter
                    queue.player.memory.adPlaytimeMs = 0;
                    await data.guild.set(guild.id, 'ads.playtimeMs', 0);
                }
            }
        }

        // Handle loop edge cases
        if (queue.loop.type === LoopType.Song) {
            if (track.info.length <= 15 * 1000) {
                queue.setLoop(LoopType.None);
                await queue.player.sendMessage(
                    guild.locale('MUSIC.PLAYER.LOOP_TRACK_DISABLED'),
                    { type: MessageOptionsBuilderType.Warning },
                );
            }
        }

        if (queue.loop.type === LoopType.Queue) {
            // Check if queue is too short for looping
            const totalDuration = queue.tracks.reduce(
                (a: number, b: QuaverSong): number => a + b.info.length,
                track.info.length,
            );

            if (totalDuration <= 15 * 1000) {
                queue.setLoop(LoopType.None);
                await queue.player.sendMessage(
                    guild.locale('MUSIC.PLAYER.LOOP_QUEUE_DISABLED'),
                    { type: MessageOptionsBuilderType.Warning },
                );
            }

            // Handle shuffle/alternate with queue loop
            const transformsActive =
                queue.player.memory.shuffle || queue.player.memory.alternate;
            if (transformsActive) {
                if (queue.player.memory.originalQueue) {
                    queue.player.memory.originalQueue.push(track);
                }
                if (queue.player.memory.shuffledQueue) {
                    queue.player.memory.shuffledQueue.push(track.id);
                }
            }
        }

        // Clear failure count on successful track
        if (queue.player.memory.failureCount) {
            delete queue.player.memory.failureCount;
        }

        // Check if alone in voice channel
        const voiceChannel = guild.channels.cache.get(
            queue.player.voice.channelId,
        );
        const members = voiceChannel?.members as Collection<
            Snowflake,
            GuildMember
        >;

        if (
            !members?.some((m): boolean => !m.user.bot) &&
            !(
                (await guild.settings.get<boolean>('stay.enabled')) &&
                (await guild.features.isFeatureActive('stay'))
            )
        ) {
            logger.info(`[G ${guild.id}] Disconnecting (alone)`);
            await queue.player.sendMessage(
                guild.locale('MUSIC.DISCONNECT.ALONE.DISCONNECTED.DEFAULT'),
                { type: MessageOptionsBuilderType.Warning },
            );
            await queue.player.disconnect();
            return;
        }

        // Advance to next track only if the reason warrants it
        if (mayStartNext[reason]) {
            const hasNext = await queue.next();
            if (!hasNext) {
                logger.info(`[G ${guild.id}] Queue finished`);
            }
        }
    },
};
