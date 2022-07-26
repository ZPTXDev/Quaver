const { logger, data } = require('../../shared.js');
const { getLocale } = require('../../functions.js');
const { defaultLocale } = require('../../settings.json');

module.exports = {
	name: 'queueFinish',
	once: false,
	/** @param {import('@lavaclient/queue').Queue & {player: import('lavaclient').Player & {handler: import('../../classes/PlayerHandler.js')}}} queue */
	async execute(queue) {
		if (await data.guild.get(queue.player.guildId, 'settings.stay.enabled')) {
			await queue.player.handler.locale('MUSIC_QUEUE_EMPTY', {}, 'neutral');
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
			p.handler.locale('MUSIC_INACTIVITY', {}, 'warning');
			p.handler.disconnect();
		}, 1800000, queue.player);
		await queue.player.handler.send(`${getLocale(await data.guild.get(queue.player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_QUEUE_EMPTY')} ${getLocale(await data.guild.get(queue.player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_INACTIVITY_WARNING', Math.floor(Date.now() / 1000) + 1800)}`, {}, 'warning');
	},
};
