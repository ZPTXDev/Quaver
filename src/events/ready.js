import { logger } from '#lib/util/common.js';
import { version } from '#lib/util/version.js';
import { features } from '#settings';
import { ActivityType } from 'discord.js';

export default {
	name: 'ready',
	once: false,
	/** @param {import('discord.js').Client & {music: import('lavaclient').Node}} client */
	async execute(client) {
		const { startup, updateStartup, io } = await import('#src/main.js');
		if (!startup) {
			logger.info({ message: `Connected. Logged in as ${client.user.tag}.`, label: 'Discord' });
			logger.info({ message: `Running version ${version}. For help, see https://github.com/ZPTXDev/Quaver/issues.`, label: 'Quaver' });
			if (version.includes('-')) {
				logger.warn({ message: 'You are running an unstable version of Quaver. Please report bugs using the link above, and note that features may change or be removed entirely prior to release.', label: 'Quaver' });
			}
			client.music.connect(client.user.id);
			updateStartup();
		}
		else {
			logger.info({ message: 'Reconnected.', label: 'Discord' });
			logger.warn({ message: 'Attempting to resume sessions.', label: 'Quaver' });
			for (const pair of client.music.players) {
				const player = pair[1];
				await player.resume();
				if (features.web.enabled) io.to(`guild:${player.guildId}`).emit('pauseUpdate', player.paused);
			}
		}
		client.user.setActivity(`music | ${version}`, { type: ActivityType.Listening });
	},
};
