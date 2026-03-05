import { MessageOptionsBuilderType } from '#src/lib';
import { data } from '#src/lib/data';
import { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import type { QuaverPlayerJSON } from '#src/lib/music';
import type { QuaverChannels } from '#src/lib/util';
import { settings } from '#src/lib/util';
import { get } from 'lodash-es';
import { readFile, unlink, writeFile } from 'node:fs/promises';

async function readPlayerStates(): Promise<
    Record<string, QuaverPlayerJSON> & {
        savedAt?: number;
        attempts?: number;
    }
> {
    try {
        const raw = await readFile('states.json', 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            logger.error(error);
        }
        return {};
    }
}

async function deletePlayerStates(): Promise<void> {
    try {
        await unlink('states.json');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            logger.error(error);
        }
    }
}

async function savePlayerStates(
    states: Record<string, QuaverPlayerJSON>,
): Promise<void> {
    try {
        await writeFile('states.json', JSON.stringify(states, null, 4));
    } catch (error) {
        logger.error(error);
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
        let states: Record<string, QuaverPlayerJSON> & {
            savedAt?: number;
            attempts?: number;
        } = {};
        if (settings.sessionRecovery?.enabled) {
            states = await readPlayerStates();
            if (
                states.savedAt &&
                Date.now() - states.savedAt >
                    (settings.sessionRecovery.maxAge ?? 86400) * 1000
            ) {
                logger.warn(
                    'Saved player states are too old and will not be restored.',
                );
                await deletePlayerStates();
                states = {};
            } else if (
                states.attempts &&
                states.attempts >= (settings.sessionRecovery.maxAttempts ?? 1)
            ) {
                logger.warn(
                    'Maximum session recovery attempts reached. Saved player states will not be restored.',
                );
                await deletePlayerStates();
                states = {};
            } else {
                states.attempts = (states.attempts ?? 0) + 1;
                await savePlayerStates(states);
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
                try {
                    if (!snapshot.voiceChannelId) continue;
                    const player = await client.music.players.createFromJSON(
                        guild,
                        snapshot,
                    );
                    await player.sendMessage(
                        guild.locale('MUSIC.PLAYER.RESTORING'),
                        { type: MessageOptionsBuilderType.Success },
                    );
                    player.voice.connect(snapshot.voiceChannelId, {
                        deafened: true,
                    });
                    if (
                        snapshot.queue.current &&
                        (snapshot.paused || snapshot.playing)
                    ) {
                        await player.play(snapshot.queue.current);
                    }
                    if (snapshot.position > 0) {
                        await player.seekTo(snapshot.position);
                    }
                    logger.info(
                        `[G ${guildId}] Player restored from saved state`,
                    );
                } catch (error) {
                    logger.error(
                        `[G ${guildId}] Failed to restore player`,
                        error,
                    );
                }
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
        await deletePlayerStates();
    },
};
