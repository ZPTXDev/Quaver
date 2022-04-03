const { logger } = require('../../shared.js');
const { shuttingDown } = require('../../main.js');

module.exports = {
	name: 'error',
	once: false,
	execute(err) {
		logger.error({ message: 'An error occurred. Quaver will now shut down to prevent any further issues.', label: 'Lavalink' });
		shuttingDown('lavalink', err);
	},
};
