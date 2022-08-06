const { logger } = require('#lib/util/common.js');

module.exports = {
	name: 'disconnect',
	once: false,
	execute() {
		logger.warn({ message: 'Disconnected.', label: 'Lavalink' });
	},
};
