const { logger } = require('../../shared.js');

module.exports = {
	name: 'disconnect',
	once: false,
	execute() {
		logger.warn({ message: 'Disconnected.', label: 'Lavalink' });
	},
};
