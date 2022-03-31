const { logger } = require('../shared.js');

module.exports = {
	name: 'shardError',
	once: false,
	execute(err) {
		logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
	},
};
