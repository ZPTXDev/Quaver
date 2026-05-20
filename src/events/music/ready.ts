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
        if (!resumed) {
            player.voice.connect(snapshot.voiceChannelId, {
                deafened: true,
            });
            if (snapshot.queue.current && (snapshot.paused || snapshot.playing)) {
                await player.play(snapshot.queue.current);
            }
            if (snapshot.position > 0) {
                await player.seekTo(snapshot.position);
            }
        } else {
            player.voice.connect(snapshot.voiceChannelId, {
                deafened: true,
            });
        }
        logger.info(`[G ${guild.id}] Player restored from saved state (resumed = ${resumed})`);
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
