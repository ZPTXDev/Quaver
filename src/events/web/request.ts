import { version } from '#src/lib/util/version.js';
import { Queue, Song } from '@lavaclient/queue';
import { APIGuild, TextChannel, VoiceChannel } from 'discord.js';
import { Node, Player } from 'lavaclient';
import { Socket } from 'socket.io';

export default {
	name: 'request',
	once: false,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async execute(socket: Socket & { guilds: APIGuild[] }, callback: (cb: Record<string, any>) => void, guildId: string, item: 'player'): Promise<void> {
		const { bot } = await import('#src/main.js');
		if (!socket.guilds) return callback({ status: 'error-auth' });
		if (!socket.guilds.find((guild): boolean => guild.id === guildId)) return callback({ status: 'error-auth' });
		if (!bot.guilds.cache.get(guildId)) return callback({ status: 'error-generic' });
		let response;
		switch (item) {
			case 'player': {
				const player: Player<Node> & {
					queue?: Queue & {
						current?: Song & { requesterTag?: string };
						channel?: TextChannel | VoiceChannel
					};
					bassboost?: boolean;
					nightcore?: boolean;
					skip?: { required: number, users: string[] };
					timeout?: ReturnType<typeof setTimeout>;
					pauseTimeout?: ReturnType<typeof setTimeout>;
					timeoutEnd?: number;
				} = bot.music.players.get(guildId);
				player?.queue.current && (player.queue.current.requesterTag = bot.users.cache.get(player.queue.current.requester)?.tag);
				response = player ? {
					queue: player.queue.tracks.map((track: Song & { requesterTag: string }): Song & { requesterTag: string } => {track.requesterTag = bot.users.cache.get(track.requester)?.tag; return track;}),
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
