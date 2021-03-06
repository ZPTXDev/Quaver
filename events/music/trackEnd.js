const { logger, data } = require('../../shared.js');
const { bot } = require('../../main.js');

module.exports = {
	name: 'trackEnd',
	once: false,
	/**
	 * @param {import('@lavaclient/queue').Queue & {player: import('lavaclient').Player & {handler: import('../../classes/PlayerHandler.js')}}} queue
	 * @param {import('@lavaclient/queue').Song} track
	 * @param {'PLAYLIST_LOADED'|'TRACK_LOADED'|'SEARCH_RESULT'|'NO_MATCHES'|'LOAD_FAILED'} reason
	 */
	async execute(queue, track, reason) {
		delete queue.player.skip;
		if (reason === 'LOAD_FAILED') {
			logger.warn({ message: `[G ${queue.player.guildId}] Track skipped with reason: ${reason}`, label: 'Quaver' });
			await queue.player.handler.locale('MUSIC_TRACK_SKIPPED', {}, true, track.title, track.uri, reason);
		}
		if (bot.guilds.cache.get(queue.player.guildId).channels.cache.get(queue.player.channelId).members?.filter(m => !m.user.bot).size < 1 && !await data.guild.get(queue.player.guildId, 'settings.stay.enabled')) {
			logger.info({ message: `[G ${queue.player.guildId}] Disconnecting (alone)`, label: 'Quaver' });
			await queue.player.handler.locale('MUSIC_ALONE');
			await queue.player.handler.disconnect();
			return;
		}
	},
};
