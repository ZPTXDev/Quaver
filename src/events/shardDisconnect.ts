import { EventHandler } from '#src/lib/builders';
import { logger } from '#src/lib/util/common';

export default new EventHandler()
    .setEvent('shardDisconnect')
    .setExecute(function(): void {
        logger.warn({ message: 'Disconnected.', label: 'Discord' });
    });
