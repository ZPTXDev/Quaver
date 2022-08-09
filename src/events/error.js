import { logger } from '#lib/util/common.js';

export default {
	name: 'error',
	once: false,
	/** @param {Error} err */
	async execute(err) {
		const { shuttingDown } = await import('#src/main.js');
		logger.error({ message: 'An error occurred. Quaver will now shut down to prevent any further issues.', label: 'Discord' });
		await shuttingDown('discord', err);
	},
};
