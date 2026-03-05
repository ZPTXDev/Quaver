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
): Promise<void> {
    try {
        if (!snapshot.voiceChannelId) return;
        const player = await guild.client.music.players.createFromJSON(
            guild,
            snapshot,
        );
        await player.sendMessage(guild.locale('MUSIC.PLAYER.RESTORING'), {
            type: MessageOptionsBuilderType.Success,
        });
        player.voice.connect(snapshot.voiceChannelId, {
            deafened: true,
        });
        if (snapshot.queue.current && (snapshot.paused || snapshot.playing)) {
            await player.play(snapshot.queue.current);
        }
        if (snapshot.position > 0) {
            await player.seekTo(snapshot.position);
        }
        logger.info(`[G ${guild.id}] Player restored from saved state`);
    } catch (error) {
        logger.error(`[G ${guild.id}] Failed to restore player`, error);
    }
}

export default {
    name: 'ready',
    once: false,
    async execute(): Promise<void> {
        const { client } = await import('#src/main');
        logger.info({ message: 'Ready.', label: 'Lavalink' });
        if (!client.music.ws.session) {
            logger.warn(
                'Waiting 5 seconds before re-triggering ready event for Lavalink WS session...',
            );
            setTimeout((): void => {
                this.execute();
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
                await restorePlayer(guild, snapshot);
                continue;
            }
            if (get(guildData, 'settings.stay.enabled')) {
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
