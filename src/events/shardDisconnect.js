import { logger } from '#lib/util/common.js';

export default {
	name: 'shardDisconnect',
	once: false,
	execute() {
		logger.warn({ message: 'Disconnected.', label: 'Discord' });
	},
};
