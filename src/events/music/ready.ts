import { MessageOptionsBuilderType } from '#src/lib';
import { data } from '#src/lib/data';
import { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import type { QuaverPlayerJSON } from '#src/lib/music';
import type { QuaverChannels } from '#src/lib/util';
import { get } from 'lodash-es';
import { readFile, unlink } from 'node:fs/promises';

async function readPlayerStates(): Promise<Record<string, QuaverPlayerJSON>> {
    try {
        const raw = await readFile('states.json', 'utf8');
        await unlink('states.json');
        return JSON.parse(raw);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            logger.error(error);
        }
        return {};
    }
}

export default {
    name: 'connected',
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
        const states = await readPlayerStates();
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
                    if (!snapshot.voiceChannelId) return;
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
    },
};
