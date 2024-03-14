import type { QuaverClient, QuaverPlayer } from '#src/lib/util/common.d.js';
import { data, logger } from '#src/lib/util/common.js';
import type { Guild } from 'discord.js';

export default {
    name: 'guildDelete',
    once: false,
    async execute(guild: Guild & { client: QuaverClient }): Promise<void> {
        logger.info({
            message: `[G ${guild.id}] Left guild ${guild.name}`,
            label: 'Discord',
        });
        const player = (await guild.client.music.players.fetch(
            guild.id,
        )) as QuaverPlayer;
        if (player) {
            logger.info({
                message: `[G ${guild.id}] Cleaning up (left guild)`,
                label: 'Quaver',
            });
            player.voice.channelId = null;
            if (await data.guild.get(player.id, 'settings.stay.enabled')) {
                await data.guild.set(player.id, 'settings.stay.enabled', false);
            }
            await player.handler.disconnect();
        }
    },
};
