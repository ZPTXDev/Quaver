import CryptoJS from 'crypto-js';
import { request } from 'undici';
import { applicationId, clientSecret, features } from '#settings';
import { getJSONResponse } from '#lib/util/util.js';

export default {
	name: 'exchange',
	once: false,
	async execute(socket, accessCode, redirectURI, callback) {
		try {
			const tokenResponseData = await request('https://discord.com/api/oauth2/token', {
				method: 'POST',
				body: new URLSearchParams({
					client_id: applicationId,
					client_secret: clientSecret,
					code: accessCode,
					grant_type: 'authorization_code',
					redirect_uri: redirectURI,
					scope: 'identify guilds',
				}).toString(),
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			});
			const oauthData = await getJSONResponse(tokenResponseData.body);
			const encryptedToken = CryptoJS.AES.encrypt(`${oauthData.token_type} ${oauthData.access_token}`, features.web.encryptionKey).toString();
			return callback({ status: 'success', encryptedToken });
		}
		catch (err) {
			return callback({ status: 'error-generic', err });
		}
	},
};
