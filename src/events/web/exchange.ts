import { settings } from '#src/lib/util/settings.js';
import { getJSONResponse } from '#src/lib/util/util.js';
import CryptoJS from 'crypto-js';
import type { Socket } from 'socket.io';
import { request } from 'undici';
import type { OAuth2Data } from './exchange.types.js';

export default {
	name: 'exchange',
	once: false,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async execute(socket: Socket, callback: (cb: Record<string, any>) => void, accessCode: string, redirectURI: string): Promise<void> {
		try {
			const tokenResponseData = await request('https://discord.com/api/oauth2/token', {
				method: 'POST',
				body: new URLSearchParams({
					client_id: settings.applicationId,
					client_secret: settings.clientSecret,
					code: accessCode,
					grant_type: 'authorization_code',
					redirect_uri: redirectURI,
					scope: 'identify guilds',
				}).toString(),
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			});
			const oauthData = await getJSONResponse(tokenResponseData.body) as OAuth2Data;
			const encryptedToken = CryptoJS.AES.encrypt(`${oauthData.token_type} ${oauthData.access_token}`, settings.features.web.encryptionKey).toString();
			return callback({ status: 'success', encryptedToken });
		}
		catch (err) {
			return callback({ status: 'error-generic', err });
		}
	},
};
