const { logger } = require('../shared.js');

module.exports = {
	name: 'shardError',
	once: false,
	/** @param {Error} err */
	execute(err) {
		logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
	},
};
