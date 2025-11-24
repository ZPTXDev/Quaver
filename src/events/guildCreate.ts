import { EventHandler } from '#src/lib/builders';
import { logger } from '#src/lib/logger';

export default new EventHandler()
    .setEvent('guildCreate')
    .setExecute(function (guild): void {
        logger.info({
            message: `[G ${guild.id}] Joined guild ${guild.name}`,
            label: 'Discord',
        });
    });
