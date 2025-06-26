import { logger } from '#src/lib/util/common.js';

export default {
    name: 'connected',
    once: false,
    async execute(): Promise<void> {
        logger.info({ message: 'Connected.', label: 'Lavalink' });
    },
};
