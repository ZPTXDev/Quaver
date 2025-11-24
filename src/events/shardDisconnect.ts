import { EventHandler } from '#src/lib/builders';
import { logger } from '#src/lib/logger';

export default new EventHandler()
    .setEvent('shardDisconnect')
    .setExecute(function (): void {
        logger.warn({ message: 'Disconnected.', label: 'Discord' });
    });
