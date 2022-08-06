const { logger } = require('#lib/util/common.js');

module.exports = {
	name: 'shardDisconnect',
	once: false,
	execute() {
		logger.warn({ message: 'Disconnected.', label: 'Discord' });
	},
};
