import { settings } from '#src/lib/util/settings.js';
import { logger, data } from '#src/lib/util/common.js';
import { getGuildLocaleString } from '#src/lib/util/util.js';
import { Queue } from '@lavaclient/queue';
import { Node, Player } from 'lavaclient';
import PlayerHandler from '#src/lib/PlayerHandler.js';

export default {
	name: 'queueFinish',
	once: false,
	async execute(queue: Queue & { player: Player<Node> & { handler: PlayerHandler, timeout: ReturnType<typeof setTimeout>, pauseTimeout: ReturnType<typeof setTimeout>, timeoutEnd: number } }): Promise<void> {
		const { io } = await import('#src/main.js');
		if (await data.guild.get(queue.player.guildId, 'settings.stay.enabled')) {
			await queue.player.handler.locale('MUSIC.QUEUE.EMPTY');
			return;
		}
		// rare case where the bot sets timeout after setting pause timeout
		if (queue.player.pauseTimeout) return;
		logger.info({ message: `[G ${queue.player.guildId}] Setting timeout`, label: 'Quaver' });
		if (queue.player.timeout) clearTimeout(queue.player.timeout);
		queue.player.timeout = setTimeout((p): void => {
			logger.info({ message: `[G ${p.guildId}] Disconnecting (inactivity)`, label: 'Quaver' });
			p.handler.locale('MUSIC.DISCONNECT.INACTIVITY.DISCONNECTED', { type: 'warning' });
			p.handler.disconnect();
		}, 30 * 60 * 1000, queue.player);
		queue.player.timeoutEnd = Date.now() + (30 * 60 * 1000);
		if (settings.features.web.enabled) io.to(`guild:${queue.player.guildId}`).emit('timeoutUpdate', queue.player.timeoutEnd);
		await queue.player.handler.send(`${await getGuildLocaleString(queue.player.guildId, 'MUSIC.QUEUE.EMPTY')} ${await getGuildLocaleString(queue.player.guildId, 'MUSIC.DISCONNECT.INACTIVITY.WARNING', (Math.floor(Date.now() / 1000) + (30 * 60)).toString())}`, { type: 'warning' });
	},
};
