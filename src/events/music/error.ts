import { logger } from '#src/lib/logger';
import { updateHandler } from '#src/lib/state';

export default {
    name: 'error',
    once: false,
    async execute(err: Error): Promise<void> {
        logger.error({
            message:
                'An error occurred. Quaver will now shut down to prevent any further issues.',
            label: 'Lavalink',
        });
        return updateHandler.restart('immediate', 'lavalink', err);
    },
};
