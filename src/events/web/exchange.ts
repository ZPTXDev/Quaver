import { settings } from '#src/lib/util';
import { getJSONResponse } from '@zptxdev/zptx-lib';
import CryptoJS from 'crypto-js';
import type { Socket } from 'socket.io';
import { request } from 'undici';

type OAuth2Data = {
    token_type: string;
    access_token: string;
    error?: string;
    error_description?: string;
};

export default {
    name: 'exchange',
    once: false,
    async execute(
        socket: Socket,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: (cb: Record<string, any>) => void,
        accessCode: string,
        redirectURI: string,
    ): Promise<void> {
        try {
            const tokenResponseData = await request(
                'https://discord.com/api/oauth2/token',
                {
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
                },
            );
            const oauthData = (await getJSONResponse(
                tokenResponseData.body,
            )) as OAuth2Data;
            if (oauthData.error) {
                return callback({
                    status: 'error-auth',
                    error: oauthData.error,
                });
            }
            const encryptedToken = CryptoJS.AES.encrypt(
                `${oauthData.token_type} ${oauthData.access_token}`,
                settings.features.web.encryptionKey,
            ).toString();
            return callback({ status: 'success', encryptedToken });
        } catch (error) {
            if (error instanceof Error) {
                return callback({ status: 'error-generic', error });
            }
        }
    },
};
