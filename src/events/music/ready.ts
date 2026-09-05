import { MessageOptionsBuilderType } from '#src/lib';
import { data } from '#src/lib/data';
import type { Initialized } from '#src/lib/guild';
import { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import type { PlayerStatesRecord, QuaverPlayerJSON } from '#src/lib/music';
import { PlayerStateManager } from '#src/lib/music';
import type { QuaverChannels } from '#src/lib/util';
import { settings } from '#src/lib/util';
import type { Guild } from 'discord.js';
import { get } from 'lodash-es';

async function restorePlayer(
    guild: QuaverGuild<Initialized> & Guild,
    snapshot: QuaverPlayerJSON,
    resumed: boolean,
): Promise<boolean> {
    try {
        if (!snapshot.voiceChannelId) return false;
        const player = await guild.client.music.players.createFromJSON(
            guild,
            snapshot,
            resumed,
        );
        await player.sendMessage(guild.locale('MUSIC.PLAYER.RESTORING'), {
            type: MessageOptionsBuilderType.Success,
        });
        
        // Connect to voice channel first
        player.voice.connect(snapshot.voiceChannelId, {
            deafened: true,
        });

        // Auto-unpause if the pause was initiated by the bot (e.g., due to inactivity)
        // This must happen before handling resumed state to ensure proper playback resumption
        try {
            if (snapshot.paused && Array.isArray(snapshot.sessionLogs)) {
                const lastPause = [...snapshot.sessionLogs]
                    .reverse()
                    .find((l): boolean => l.action === 'PAUSE');
                // detect if the pause was by the bot (no user present)
                if (
                    lastPause &&
                    !lastPause.userId &&
                    !lastPause.userTag &&
                    Date.now() - lastPause.timestamp < 15_000
                ) {
                    await player.setPause(false);
                    logger.info(`[G ${guild.id}] Unpaused restored player`);
                }
            }
        } catch (err) {
            // don't fail the whole restore if unpause fails; log and continue
            logger.warn(
                `[G ${guild.id}] Failed to auto-unpause restored player: ${err instanceof Error ? err.message : String(err)}`,
            );
        }

        // Check if the current track is an ad and skip it
        // Also check memory.isAdPlaying since toJSON sets queue.current to null for ads
        const isAdTrack = snapshot.queue.current?.isAd === true || snapshot.memory.isAdPlaying;
        if (isAdTrack) {
            // Clean up ad state before advancing (mirror trackEnd ad cleanup path)
            player.memory.isAdPlaying = false;
            player.memory.adPlaytimeMs = 0;
            await data.guild.set(guild.id, 'ads.playtimeMs', 0);

            // Restore saved filters
            if (player.memory.savedFilters) {
                await player.setBassboost(player.memory.savedFilters.bassboost);
                await player.setNightcore(player.memory.savedFilters.nightcore);
                delete player.memory.savedFilters;
            }

            // If resumed, stop the current track (Lavalink already started it)
            if (resumed && player.playing) {
                await player.stop();
            }
            // Advance to the next track
            await player.queue.start();
        } else if (!resumed) {
            // Normal restoration for non-ad tracks (not resumed)
            if (snapshot.queue.current && (snapshot.paused || snapshot.playing)) {
                await player.play(snapshot.queue.current);
            }
            if (snapshot.position > 0) {
                await player.seekTo(snapshot.position);
            }
        } else if (!player.playing && player.queue.tracks.length > 0) {
            // When resumed=true, Lavalink has already positioned the track correctly
            // However, if the player is not playing and there are queued tracks, start the next one
            await player.queue.start();
        }

        // Set timeout if queue is empty after restoration
        if (!player.queue.current && player.queue.tracks.length === 0) {
            if (await guild.settings.get<boolean>('stay.enabled') && await guild.features.isFeatureActive('stay')) {
                await player.sendMessage(guild.locale('MUSIC.QUEUE.EMPTY'));
            } else if (!player.timeout.pause) {
                logger.info(`[G ${guild.id}] Setting timeout after restoration with empty queue`);
                if (player.timeout.standard) {
                    clearTimeout(player.timeout.standard);
                }
                player.timeout.standard = setTimeout(
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
                    player,
                    guild,
                );
                player.timeout.end = Date.now() + 30 * 60 * 1000;
                guild.sendWebUpdate('timeoutUpdate', player.timeout.end);
                await player.sendMessage(
                    `${guild.locale('MUSIC.QUEUE.EMPTY')} ${guild.locale(
                        'MUSIC.DISCONNECT.INACTIVITY.WARNING',
                        (Math.floor(Date.now() / 1000) + 30 * 60).toString(),
                    )}`,
                    { type: MessageOptionsBuilderType.Warning },
                );
            }
        }

        logger.info(
            `[G ${guild.id}] Player restored from saved state (resumed = ${resumed})`,
        );
        return true;
    } catch (error) {
        logger.error(`[G ${guild.id}] Failed to restore player`, error);
        return false;
    }
}

export default {
    name: 'ready',
    once: false,
    async execute(event?: { took: number; resumed: boolean }): Promise<void> {
        const { client } = await import('#src/main');
        logger.info({ message: 'Ready.', label: 'Lavalink' });
        if (!client.music.ws.session) {
            logger.warn(
                'Waiting 5 seconds before re-triggering ready event for Lavalink WS session...',
            );
            setTimeout((): void => {
                this.execute(event);
            }, 1_000);
            return;
        }
        const stateManager = new PlayerStateManager();
        let states: PlayerStatesRecord = {};
        if (settings.sessionRecovery?.enabled) {
            states = await stateManager.read();
            if (!stateManager.shouldRestore(states)) {
                await stateManager.delete();
                states = {};
            } else {
                states.attempts = (states.attempts ?? 0) + 1;
                await stateManager.save(states);
            }
        }
        for await (const [
            guildId,
            guildData,
        ] of data.guild.instance.iterator()) {
            const discordGuild = client.guilds.cache.get(guildId);
            if (!discordGuild) continue;
            const guild = await QuaverGuild.wrap(discordGuild);
            const snapshot = states[guildId];
            if (snapshot) {
                const restored = await restorePlayer(
                    guild,
                    snapshot,
                    !!event?.resumed,
                );
                if (restored) continue;
            }
            if (get(guildData, 'settings.stay.enabled') && await guild.features.isFeatureActive('stay')) {
                const player = client.music.players.create(guild);
                player.queue.channel = guild.channels.cache.get(
                    get(guildData, 'settings.stay.text'),
                ) as QuaverChannels;
                player.voice.connect(get(guildData, 'settings.stay.channel'), {
                    deafened: true,
                });
            }
        }
        await stateManager.delete();
    },
};
