import { defaultLocale } from '#settings';
import { logger, data } from '#lib/util/common.js';
import { getLocale } from '#lib/util/util.js';

export default {
	name: 'queueFinish',
	once: false,
	/** @param {import('@lavaclient/queue').Queue & {player: import('lavaclient').Player & {handler: import('#lib/PlayerHandler.js').default}}} queue */
	async execute(queue) {
		if (await data.guild.get(queue.player.guildId, 'settings.stay.enabled')) {
			await queue.player.handler.locale('MUSIC.QUEUE.EMPTY', {}, 'neutral');
			return;
		}
		// rare case where the bot sets timeout after setting pause timeout
		if (queue.player.pauseTimeout) return;
		logger.info({ message: `[G ${queue.player.guildId}] Setting timeout`, label: 'Quaver' });
		if (queue.player.timeout) {
			clearTimeout(queue.player.timeout);
		}
		queue.player.timeout = setTimeout(p => {
			logger.info({ message: `[G ${p.guildId}] Disconnecting (inactivity)`, label: 'Quaver' });
			p.handler.locale('MUSIC.DISCONNECT.INACTIVITY.DISCONNECTED', {}, 'warning');
			p.handler.disconnect();
		}, 1800000, queue.player);
		await queue.player.handler.send(`${getLocale(await data.guild.get(queue.player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC.QUEUE.EMPTY')} ${getLocale(await data.guild.get(queue.player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC.DISCONNECT.INACTIVITY.WARNING', Math.floor(Date.now() / 1000) + 1800)}`, {}, 'warning');
	},
};
