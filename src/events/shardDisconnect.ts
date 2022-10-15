import { logger } from '#src/lib/util/common.js';

export default {
    name: 'shardDisconnect',
    once: false,
    execute(): void {
        logger.warn({ message: 'Disconnected.', label: 'Discord' });
    },
};
