const { logger, guildData } = require('../../shared.js');
const { getLocale, msToTime, msToTimeString } = require('../../functions.js');
const { defaultLocale } = require('../../settings.json');

module.exports = {
	name: 'trackStart',
	once: false,
	async execute(queue, track) {
		logger.info({ message: `[G ${queue.player.guildId}] Starting track`, label: 'Quaver' });
		queue.player.pause(false);
		if (queue.player.timeout) {
			clearTimeout(queue.player.timeout);
			delete queue.player.timeout;
		}
		const duration = msToTime(track.length);
		const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
		await queue.player.musicHandler.send(`${getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_NOW_PLAYING', track.title, track.uri, durationString)}\n${getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ADDED_BY', track.requester)}`);
	},
};
