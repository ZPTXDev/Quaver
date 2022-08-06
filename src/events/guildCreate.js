const { logger } = require('#lib/util/common.js');

module.exports = {
	name: 'guildCreate',
	once: false,
	/** @param {import('discord.js').Guild} guild */
	execute(guild) {
		logger.info({ message: `[G ${guild.id}] Joined guild ${guild.name}`, label: 'Discord' });
	},
};
