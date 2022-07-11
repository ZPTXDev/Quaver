const { logger, data } = require('../../shared.js');
const { getLocale } = require('../../functions.js');
const { defaultLocale } = require('../../settings.json');

module.exports = {
	name: 'queueFinish',
	once: false,
	async execute(queue) {
		if (await data.guild.get(queue.player.guildId, 'settings.stay.enabled')) {
			queue.player.handler.locale('MUSIC_QUEUE_EMPTY');
			return;
		}
		logger.info({ message: `[G ${queue.player.guildId}] Setting timeout`, label: 'Quaver' });
		if (queue.player.timeout) {
			clearTimeout(queue.player.timeout);
		}
		queue.player.timeout = setTimeout(p => {
			logger.info({ message: `[G ${p.guildId}] Disconnecting (inactivity)`, label: 'Quaver' });
			p.handler.locale('MUSIC_INACTIVITY');
			p.handler.disconnect();
		}, 1800000, queue.player);
		queue.player.handler.send(`${getLocale(await data.guild.get(queue.player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_QUEUE_EMPTY')} ${getLocale(await data.guild.get(queue.player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_INACTIVITY_WARNING', Math.floor(Date.now() / 1000) + 1800)}`);
	},
};
