import CryptoJS from 'crypto-js';
import { request } from 'undici';
import { features } from '#src/settings.js';
import { getJSONResponse } from '#src/lib/util/util.js';
import { version } from '#src/lib/util/version.js';
import { Socket } from 'socket.io';
import { APIGuild } from 'discord.js';

export default {
	name: 'fetchguilds',
	once: false,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async execute(socket: Socket & { guilds: (APIGuild & { botInGuild?: boolean })[] }, callback: (cb: Record<string, any>) => void, token?: string): Promise<void> {
		const { bot } = await import('#src/main.js');
		if (!token) return;
		const decryptedToken = CryptoJS.AES.decrypt(token, features.web.encryptionKey).toString(CryptoJS.enc.Utf8);
		const guilds = await request('https://discord.com/api/users/@me/guilds', {
			headers: {
				'Authorization': decryptedToken,
			},
		});
		let response = <{ message?: string } & (APIGuild & { botInGuild?: boolean })[]> await getJSONResponse(guilds.body);
		if (response.message) return callback({ status: 'error-auth' });
		response = response.map((guild): APIGuild & { botInGuild?: boolean } => {
			guild.botInGuild = !!bot.guilds.cache.get(guild.id);
			return guild;
		});
		socket.guilds = response;
		return callback({ status: 'success', guilds: response, version });
	},
};
