const { logger, guildData } = require('../../shared.js');
const { getLocale } = require('../../functions.js');
const { defaultLocale } = require('../../settings.json');

module.exports = {
	name: 'queueFinish',
	once: false,
	execute(queue) {
		if (guildData.get(`${queue.player.guildId}.always.enabled`)) {
			queue.player.musicHandler.locale('MUSIC_QUEUE_EMPTY');
			return;
		}
		logger.info({ message: `[G ${queue.player.guildId}] Setting timeout`, label: 'Quaver' });
		if (queue.player.timeout) {
			clearTimeout(queue.player.timeout);
		}
		queue.player.timeout = setTimeout(p => {
			logger.info({ message: `[G ${p.guildId}] Disconnecting (inactivity)`, label: 'Quaver' });
			p.musicHandler.disconnect();
			p.musicHandler.locale('MUSIC_INACTIVITY');
		}, 1800000, queue.player);
		queue.player.musicHandler.send(`${getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_QUEUE_EMPTY')} ${getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_INACTIVITY_WARNING', Math.floor(Date.now() / 1000) + 1800)}`);
	},
};
