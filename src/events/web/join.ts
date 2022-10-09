import type { APIGuild } from 'discord.js';
import type { Socket } from 'socket.io';

export default {
	name: 'join',
	once: false,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async execute(socket: Socket & { guilds: APIGuild[] }, callback: (cb: Record<string, any>) => void, guildId: string): Promise<void> {
		const { bot } = await import('#src/main.js');
		if (!socket.guilds) return callback({ status: 'error-auth' });
		if (!socket.guilds.find((guild): boolean => guild.id === guildId)) return callback({ status: 'error-auth' });
		if (!bot.guilds.cache.get(guildId)) return callback({ status: 'error-generic' });
		socket.join(`guild:${guildId}`);
		return callback({ status: 'success' });
	},
};
