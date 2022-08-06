const { logger } = require('#lib/util/common.js');

module.exports = {
	name: 'error',
	once: false,
	/** @param {Error} err */
	execute(err) {
		logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
	},
};
