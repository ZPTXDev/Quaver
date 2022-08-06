import { logger } from '#lib/util/common.js';
import { shuttingDown } from '#src/main.js';

export default {
	name: 'error',
	once: false,
	/** @param {Error} err */
	async execute(err) {
		logger.error({ message: 'An error occurred. Quaver will now shut down to prevent any further issues.', label: 'Lavalink' });
		await shuttingDown('lavalink', err);
	},
};
