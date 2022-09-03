import { ActivityType } from 'discord.js';
import { logger } from '#lib/util/common.js';
import { version } from '#lib/util/version.js';

export default {
	name: 'shardResume',
	once: false,
	async execute() {
		const { bot } = await import('#src/main.js');
		bot.user.setActivity(`music | ${version}`, { type: ActivityType.Listening });
		logger.info({ message: 'Reconnected.', label: 'Discord' });
	},
};
