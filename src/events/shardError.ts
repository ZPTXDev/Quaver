import { logger } from '#src/lib/util/common.js';

export default {
	name: 'shardError',
	once: false,
	execute(err: Error): void {
		logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
	},
};
