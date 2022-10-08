import { logger } from '#src/lib/util/common.js';

export default {
	name: 'disconnect',
	once: false,
	execute(): void {
		logger.warn({ message: 'Disconnected.', label: 'Lavalink' });
	},
};
