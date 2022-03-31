const { logger } = require('../shared.js');

module.exports = {
	name: 'guildCreate',
	once: false,
	execute(guild) {
		logger.info({ message: `[G ${guild.id}] Joined guild ${guild.name}`, label: 'Discord' });
	},
};
