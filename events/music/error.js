const { logger } = require('../../shared.js');
const { shuttingDown } = require('../../main.js');

module.exports = {
	name: 'error',
	once: false,
	/** @param {Error} err */
	async execute(err) {
		logger.error({ message: 'An error occurred. Quaver will now shut down to prevent any further issues.', label: 'Lavalink' });
		await shuttingDown('lavalink', err);
	},
};
