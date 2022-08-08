import { defaultLocale } from '#settings';
import { logger, data } from '#lib/util/common.js';
import { getLocale, msToTime, msToTimeString } from '#lib/util/util.js';

export default {
	name: 'trackStart',
	once: false,
	/**
	 * @param {import('@lavaclient/queue').Queue & {player: import('lavaclient').Player & {handler: import('#lib/PlayerHandler.js').default}}} queue
	 * @param {import('@lavaclient/queue').Song} track
	 */
	async execute(queue, track) {
		logger.info({ message: `[G ${queue.player.guildId}] Starting track`, label: 'Quaver' });
		queue.player.pause(false);
		if (queue.player.timeout) {
			clearTimeout(queue.player.timeout);
			delete queue.player.timeout;
		}
		const duration = msToTime(track.length);
		const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
		await queue.player.handler.send(`${getLocale(await data.guild.get(queue.player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC.PLAYER.PLAYING.NOW', track.title, track.uri, durationString)}\n${getLocale(await data.guild.get(queue.player.guildId, 'settings.locale') ?? defaultLocale, 'MISC.ADDED_BY', track.requester)}`, {}, 'neutral');
	},
};
