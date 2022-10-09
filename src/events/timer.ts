import { Queue, Song } from '@lavaclient/queue';
import { Node, Player } from 'lavaclient';

export default {
	name: 'timer',
	once: false,
	async execute(): Promise<void> {
		const { bot, io } = await import('#src/main.js');
		bot.music.players.forEach((player: Player<Node> & { queue: Queue & { current: Song & { requesterTag: string } }, skip: { required: number, users: string[] } }): void => {
			if (!player.queue?.current) return;
			player.queue.current.requesterTag = bot.users.cache.get(player.queue.current.requester)?.tag;
			io.to(`guild:${player.guildId}`).emit('intervalTrackUpdate', {
				elapsed: player.position ?? 0,
				duration: player.queue.current.length,
				track: player.queue.current,
				skip: player.skip,
				nothingPlaying: !player.queue.current || !player.playing && !player.paused,
			});
		});
	},
};
