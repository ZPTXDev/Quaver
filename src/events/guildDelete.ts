import { logger } from '#src/lib/util/common.js';
import { Guild } from 'discord.js';

export default {
	name: 'guildDelete',
	once: false,
	execute(guild: Guild): void {
		logger.info({ message: `[G ${guild.id}] Left guild ${guild.name}`, label: 'Discord' });
	},
};
