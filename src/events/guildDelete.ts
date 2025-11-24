import type { QuaverClient } from '#src/lib';
import { EventHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import type { Guild } from 'discord.js';

export default new EventHandler()
    .setEvent('guildDelete')
    .setExecute(async function (
        guild: Guild & { client: QuaverClient },
    ): Promise<void> {
        logger.info({
            message: `[G ${guild.id}] Left guild ${guild.name}`,
            label: 'Discord',
        });
        const player = await guild.client.music.players.fetch(guild.id);
        const g = await QuaverGuild.wrap(guild);
        if (player) {
            logger.info({
                message: `[G ${g.id}] Cleaning up (left guild)`,
                label: 'Quaver',
            });
            player.voice.channelId = null;
            if (await g.settings.get<boolean>('stay.enabled')) {
                await g.settings.set('stay.enabled', false);
            }
            await player.disconnect();
        }
    });
