import type { QuaverPlayer, QuaverSong } from '#src/lib/util/common.d.js';
import { version } from '#src/lib/util/version.js';
import type { APIGuild, Snowflake } from 'discord.js';
import type { Socket } from 'socket.io';

export default {
	name: 'request',
	once: false,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async execute(socket: Socket & { guilds: APIGuild[] }, callback: (cb: Record<string, any>) => void, guildId: Snowflake, item: 'player'): Promise<void> {
		const { bot } = await import('#src/main.js');
		if (!socket.guilds) return callback({ status: 'error-auth' });
		if (!socket.guilds.find((guild): boolean => guild.id === guildId)) return callback({ status: 'error-auth' });
		if (!bot.guilds.cache.get(guildId)) return callback({ status: 'error-generic' });
		let response;
		switch (item) {
			case 'player': {
				const player = bot.music.players.get(guildId) as QuaverPlayer;
				if (player?.queue.current) player.queue.current.requesterTag = bot.users.cache.get(player.queue.current.requester)?.tag;
				response = player ? {
					queue: player.queue.tracks.map((track: QuaverSong): QuaverSong => {
						track.requesterTag = bot.users.cache.get(track.requester)?.tag;
						return track;
					}),
					volume: player.volume,
					loop: player.queue.loop.type,
					filters: {
						bassboost: player.bassboost,
						nightcore: player.nightcore,
					},
					paused: player.paused,
					playing: {
						track: player.queue.current,
						elapsed: player.position ?? 0,
						duration: player.queue.current ? player.queue.current.length : 0,
						skip: player.skip,
						nothingPlaying: !player.queue.current || !player.playing && !player.paused,
					},
					timeout: player.timeout ? player.timeoutEnd : false,
					pauseTimeout: player.pauseTimeout ? player.timeoutEnd : false,
					textChannel: player.queue.channel.name,
					channel: bot.guilds.cache.get(guildId).members.me.voice.channel?.name,
				} : null;
				break;
			}
		}
		return callback({ status: 'success', response, version });
	},
};
