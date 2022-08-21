export default {
	name: 'timer',
	once: false,
	async execute() {
		const { bot, io } = await import('#src/main.js');
		bot.music.players.forEach(player => {
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
