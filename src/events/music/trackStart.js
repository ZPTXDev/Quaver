import { features } from '#settings';
import { logger } from '#lib/util/common.js';
import { getGuildLocale, msToTime, msToTimeString } from '#lib/util/util.js';

export default {
	name: 'trackStart',
	once: false,
	/**
	 * @param {import('@lavaclient/queue').Queue & {player: import('lavaclient').Player & {handler: import('#lib/PlayerHandler.js').default}}} queue
	 * @param {import('@lavaclient/queue').Song} track
	 */
	async execute(queue, track) {
		const { bot, io } = await import('#src/main.js');
		delete queue.player.skip;
		logger.info({ message: `[G ${queue.player.guildId}] Starting track`, label: 'Quaver' });
		await queue.player.pause(false);
		if (features.web.enabled) io.to(`guild:${queue.player.guildId}`).emit('pauseUpdate', queue.player.paused);
		if (queue.player.timeout) {
			clearTimeout(queue.player.timeout);
			delete queue.player.timeout;
			if (features.web.enabled) io.to(`guild:${queue.player.guildId}`).emit('timeoutUpdate', !!queue.player.timeout);
		}
		const duration = msToTime(track.length);
		const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
		if (features.web.enabled) {
			io.to(`guild:${queue.player.guildId}`).emit('queueUpdate', queue.tracks.map(t => {
				t.requesterTag = bot.users.cache.get(t.requester)?.tag;
				return t;
			}));
		}
		return queue.player.handler.send(`${await getGuildLocale(queue.player.guildId, 'MUSIC.PLAYER.PLAYING.NOW', track.title, track.uri, durationString)}\n${await getGuildLocale(queue.player.guildId, 'MISC.ADDED_BY', track.requester)}`, {}, 'neutral');
	},
};
