import { logger } from '#lib/util/common.js';

export default {
	name: 'disconnect',
	once: false,
	execute() {
		logger.warn({ message: 'Disconnected.', label: 'Lavalink' });
	},
};
