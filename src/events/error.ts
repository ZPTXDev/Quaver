import { logger } from '#src/lib/util/common.js';

export default {
    name: 'error',
    once: false,
    async execute(err: Error): Promise<void> {
        const { shuttingDown } = await import('#src/main.js');
        logger.error({
            message:
                'An error occurred. Quaver will now shut down to prevent any further issues.',
            label: 'Discord',
        });
        await shuttingDown('discord', err);
    },
};
