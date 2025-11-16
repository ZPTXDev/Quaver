import { logger } from '#src/lib/util/common';

export default {
    name: 'disconnected',
    once: false,
    execute(): void {
        logger.warn({ message: 'Disconnected.', label: 'Lavalink' });
    },
};
