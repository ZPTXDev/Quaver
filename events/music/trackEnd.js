const { logger, guildData } = require('../../shared.js');
const { bot } = require('../../main.js');

module.exports = {
	name: 'trackEnd',
	once: false,
	async execute(queue, track, reason) {
		delete queue.player.skip;
		if (reason === 'LOAD_FAILED') {
			logger.warn({ message: `[G ${queue.player.guildId}] Track skipped with reason: ${reason}`, label: 'Quaver' });
			queue.player.musicHandler.locale('MUSIC_TRACK_SKIPPED', {}, true, track.title, track.uri, reason);
		}
		if (bot.guilds.cache.get(queue.player.guildId).channels.cache.get(queue.player.channelId).members?.filter(m => !m.user.bot).size < 1 && !guildData.get(`${queue.player.guildId}.always.enabled`)) {
			logger.info({ message: `[G ${queue.player.guildId}] Disconnecting (alone)`, label: 'Quaver' });
			queue.player.musicHandler.locale('MUSIC_ALONE');
			queue.player.musicHandler.disconnect();
			return;
		}
	},
};
