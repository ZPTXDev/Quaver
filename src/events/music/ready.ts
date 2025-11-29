import { data } from '#src/lib/data';
import { logger } from '#src/lib/logger';
import type { QuaverChannels } from '#src/lib/util';
import { get } from 'lodash-es';

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
            }, 5_000);
            return;
        }
        for await (const [
            guildId,
            guildData,
        ] of data.guild.instance.iterator()) {
            if (get(guildData, 'settings.stay.enabled')) {
                const guild = client.guilds.cache.get(guildId);
                if (!guild) continue;
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
