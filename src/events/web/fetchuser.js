import CryptoJS from 'crypto-js';
import { request } from 'undici';
import { features } from '#settings';
import { getJSONResponse } from '#lib/util/util.js';

export default {
	name: 'fetchuser',
	once: false,
	async execute(socket, token, callback) {
		if (!token) return;
		const decryptedToken = CryptoJS.AES.decrypt(token, features.web.encryptionKey).toString(CryptoJS.enc.Utf8);
		const user = await request('https://discord.com/api/users/@me', {
			headers: {
				'Authorization': decryptedToken,
			},
		});
		const response = await getJSONResponse(user.body);
		if (user.message) return callback({ status: 'error-auth' });
		socket.user = response;
		return callback({ status: 'success', user: response });
	},
};
