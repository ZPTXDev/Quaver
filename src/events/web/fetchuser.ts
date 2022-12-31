import type { JSONResponse } from '#src/lib/util/common.d.js';
import { settings } from '#src/lib/util/settings.js';
import { version } from '#src/lib/util/version.js';
import { getJSONResponse } from '@zptxdev/zptx-lib';
import CryptoJS from 'crypto-js';
import type { APIUser } from 'discord.js';
import type { Socket } from 'socket.io';
import { request } from 'undici';

export default {
    name: 'fetchuser',
    once: false,
    async execute(
        socket: Socket & { user: APIUser },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: (cb: Record<string, any>) => void,
        token?: string,
    ): Promise<void> {
        if (socket.user) {
            return callback({ status: 'success', user: socket.user, version });
        }
        if (!token) return;
        let decryptedToken;
        try {
            decryptedToken = CryptoJS.AES.decrypt(
                token,
                settings.features.web.encryptionKey,
            ).toString(CryptoJS.enc.Utf8);
        } catch (error) {
            return callback({ status: 'error-generic' });
        }
        const user = await request('https://discord.com/api/users/@me', {
            headers: {
                Authorization: decryptedToken,
            },
        });
        const response = (await getJSONResponse(
            user.body,
        )) as JSONResponse<APIUser>;
        if (response.message) return callback({ status: 'error-auth' });
        socket.user = response;
        return callback({ status: 'success', user: response, version });
    },
};
