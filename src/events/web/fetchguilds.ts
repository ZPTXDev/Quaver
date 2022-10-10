import type { JSONResponse } from '#src/lib/util/common.types.js';
import { settings } from '#src/lib/util/settings.js';
import { getJSONResponse } from '#src/lib/util/util.js';
import { version } from '#src/lib/util/version.js';
import CryptoJS from 'crypto-js';
import type { Socket } from 'socket.io';
import { request } from 'undici';
import type { WebGuild } from './fetchguilds.types.js';

export default {
	name: 'fetchguilds',
	once: false,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async execute(socket: Socket & { guilds: WebGuild[] }, callback: (cb: Record<string, any>) => void, token?: string): Promise<void> {
		const { bot } = await import('#src/main.js');
		if (!token) return;
		const decryptedToken = CryptoJS.AES.decrypt(token, settings.features.web.encryptionKey).toString(CryptoJS.enc.Utf8);
		const guilds = await request('https://discord.com/api/users/@me/guilds', {
			headers: {
				'Authorization': decryptedToken,
			},
		});
		let response = await getJSONResponse(guilds.body) as JSONResponse<WebGuild[]>;
		if (response.message) return callback({ status: 'error-auth' });
		response = response.map((guild): WebGuild => {
			guild.botInGuild = !!bot.guilds.cache.get(guild.id);
			return guild;
		});
		socket.guilds = response;
		return callback({ status: 'success', guilds: response, version });
	},
};
