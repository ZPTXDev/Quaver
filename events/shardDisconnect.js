const { logger } = require('../shared.js');

module.exports = {
	name: 'shardDisconnect',
	once: false,
	execute() {
		logger.warn({ message: 'Disconnected.', label: 'Discord' });
	},
};
