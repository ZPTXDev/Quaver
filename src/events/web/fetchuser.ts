import CryptoJS from 'crypto-js';
import { request } from 'undici';
import { settings } from '#src/lib/util/settings.js';
import { getJSONResponse } from '#src/lib/util/util.js';
import { version } from '#src/lib/util/version.js';
import { Socket } from 'socket.io';
import { APIUser } from 'discord.js';

export default {
	name: 'fetchuser',
	once: false,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async execute(socket: Socket & { user: APIUser }, callback: (cb: Record<string, any>) => void, token?: string): Promise<void> {
		if (!token) return;
		const decryptedToken = CryptoJS.AES.decrypt(token, settings.features.web.encryptionKey).toString(CryptoJS.enc.Utf8);
		const user = await request('https://discord.com/api/users/@me', {
			headers: {
				'Authorization': decryptedToken,
			},
		});
		const response = <{ message?: string } & APIUser> await getJSONResponse(user.body);
		if (response.message) return callback({ status: 'error-auth' });
		socket.user = response;
		return callback({ status: 'success', user: response, version });
	},
};
