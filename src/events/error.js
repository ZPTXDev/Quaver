const { logger } = require('#lib/util/common.js');
const { shuttingDown } = require('#src/main.js');

module.exports = {
	name: 'error',
	once: false,
	/** @param {Error} err */
	async execute(err) {
		logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
		await shuttingDown('discord', err);
	},
};
