import CryptoJS from 'crypto-js';
import { request } from 'undici';
import { features } from '#settings';
import { getJSONResponse } from '#lib/util/util.js';
import { version } from '#lib/util/version.js';

export default {
	name: 'fetchguilds',
	once: false,
	async execute(socket, token, callback) {
		const { bot } = await import('#src/main.js');
		if (!token) return;
		const decryptedToken = CryptoJS.AES.decrypt(token, features.web.encryptionKey).toString(CryptoJS.enc.Utf8);
		const guilds = await request('https://discord.com/api/users/@me/guilds', {
			headers: {
				'Authorization': decryptedToken,
			},
		});
		let response = await getJSONResponse(guilds.body);
		if (response.message) return callback({ status: 'error-auth' });
		response = response.map(guild => {
			guild.botInGuild = !!bot.guilds.cache.get(guild.id);
			return guild;
		});
		socket.guilds = response;
		return callback({ status: 'success', guilds: response, version });
	},
};
