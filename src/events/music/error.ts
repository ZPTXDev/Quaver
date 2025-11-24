import { logger } from '#src/lib/logger';

export default {
    name: 'error',
    once: false,
    async execute(err: Error): Promise<void> {
        const { shuttingDown } = await import('#src/main');
        logger.error({
            message:
                'An error occurred. Quaver will now shut down to prevent any further issues.',
            label: 'Lavalink',
        });
        return shuttingDown('lavalink', err);
    },
};
