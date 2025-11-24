import { logger } from '#src/lib/logger';

export default {
    name: 'disconnected',
    once: false,
    execute(): void {
        logger.warn({ message: 'Disconnected.', label: 'Lavalink' });
    },
};
