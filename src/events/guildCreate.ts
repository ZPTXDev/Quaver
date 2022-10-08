import { logger } from '#src/lib/util/common.js';
import { Guild } from 'discord.js';

export default {
	name: 'guildCreate',
	once: false,
	execute(guild: Guild): void {
		logger.info({ message: `[G ${guild.id}] Joined guild ${guild.name}`, label: 'Discord' });
	},
};
