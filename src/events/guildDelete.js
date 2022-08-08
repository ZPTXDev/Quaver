import { logger } from '#lib/util/common.js';

export default {
	name: 'guildDelete',
	once: false,
	/** @param {import('discord.js').Guild} guild */
	execute(guild) {
		logger.info({ message: `[G ${guild.id}] Left guild ${guild.name}`, label: 'Discord' });
	},
};
