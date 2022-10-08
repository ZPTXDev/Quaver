import { ActivityType, Client } from 'discord.js';
import { logger } from '#src/lib/util/common.js';
import { version } from '#src/lib/util/version.js';
import { Node } from 'lavaclient';

export default {
	name: 'ready',
	once: true,
	async execute(client: Client & { music: Node }): Promise<void> {
		const { startup } = await import('#src/main.js');
		startup.started = true;
		logger.info({ message: `Connected. Logged in as ${client.user.tag}.`, label: 'Discord' });
		logger.info({ message: `Running version ${version}. For help, see https://github.com/ZPTXDev/Quaver/issues.`, label: 'Quaver' });
		if (version.includes('-')) {
			logger.warn({ message: 'You are running an unstable version of Quaver. Please report bugs using the link above, and note that features may change or be removed entirely prior to release.', label: 'Quaver' });
		}
		client.user.setActivity(`music | ${version}`, { type: ActivityType.Listening });
		client.music.connect(client.user.id);
	},
};
