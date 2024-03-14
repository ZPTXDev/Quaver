import type {
    JSONResponse,
    WhitelistedFeatures,
} from '#src/lib/util/common.d.js';
import { settings } from '#src/lib/util/settings.js';
import {
    WhitelistStatus,
    getGuildFeatureWhitelisted,
} from '#src/lib/util/util.js';
import { version } from '#src/lib/util/version.js';
import { getJSONResponse } from '@zptxdev/zptx-lib';
import CryptoJS from 'crypto-js';
import type { Socket } from 'socket.io';
import { request } from 'undici';
import type { WebGuild } from './fetchguilds.d.js';

export default {
    name: 'fetchguilds',
    once: false,
    async execute(
        socket: Socket & { guilds: WebGuild[] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: (cb: Record<string, any>) => void,
        token?: string,
    ): Promise<void> {
        const { bot } = await import('#src/main.js');
        if (socket.guilds) {
            return callback({
                status: 'success',
                guilds: socket.guilds.map((guild): WebGuild => {
                    guild.botInGuild = !!bot.guilds.cache.get(guild.id);
                    const player =
                        guild.botInGuild &&
                        bot.music.players.cache.get(guild.id);
                    guild.idle =
                        guild.botInGuild && player
                            ? !player.queue.current ||
                              (!player.playing && !player.paused)
                            : true;
                    guild.track =
                        guild.botInGuild && !guild.idle
                            ? player.queue.current.info.title
                            : '';
                    return guild;
                }),
                version,
            });
        }
        if (!token) return;
        const decryptedToken = CryptoJS.AES.decrypt(
            token,
            settings.features.web.encryptionKey,
        ).toString(CryptoJS.enc.Utf8);
        const guilds = await request(
            'https://discord.com/api/users/@me/guilds',
            {
                headers: {
                    Authorization: decryptedToken,
                },
            },
        );
        const response = (await getJSONResponse(guilds.body)) as JSONResponse<
            WebGuild[]
        >;
        if (response.message) return callback({ status: 'error-auth' });
        const webGuilds = response.map((guild): WebGuild => {
            guild.botInGuild = !!bot.guilds.cache.get(guild.id);
            const player =
                guild.botInGuild && bot.music.players.cache.get(guild.id);
            guild.idle =
                guild.botInGuild && player
                    ? !player.queue.current ||
                      (!player.playing && !player.paused)
                    : true;
            guild.track =
                guild.botInGuild && !guild.idle
                    ? player.queue.current.info.title
                    : '';
            return guild;
        });
        if (settings.premiumURL) {
            for (const webGuild of webGuilds) {
                if (!webGuild.botInGuild) continue;
                for (const feature of [
                    'stay',
                    'autolyrics',
                    'smartqueue',
                ].filter(
                    (feat: WhitelistedFeatures): boolean =>
                        settings.features[feat].enabled &&
                        settings.features[feat].whitelist &&
                        settings.features[feat].premium,
                )) {
                    const whitelisted = await getGuildFeatureWhitelisted(
                        webGuild.id,
                        feature as WhitelistedFeatures,
                    );
                    if (
                        ![
                            WhitelistStatus.NotWhitelisted,
                            WhitelistStatus.Expired,
                        ].includes(whitelisted)
                    ) {
                        webGuild.premium = true;
                        break;
                    }
                }
            }
        }
        socket.guilds = webGuilds;
        return callback({ status: 'success', guilds: webGuilds, version });
    },
};
