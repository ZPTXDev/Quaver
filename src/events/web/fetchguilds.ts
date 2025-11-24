import {
    QuaverGuild,
    type WhitelistedFeatures,
    WhitelistStatus,
} from '#src/lib/guild';
import { type JSONResponse, settings, version } from '#src/lib/util';
import { getJSONResponse } from '@zptxdev/zptx-lib';
import CryptoJS from 'crypto-js';
import type { APIGuild } from 'discord.js';
import type { Socket } from 'socket.io';
import { request } from 'undici';

type WebGuild = APIGuild & {
    botInGuild?: boolean;
    idle?: boolean;
    track?: string;
    premium?: boolean;
};

export default {
    name: 'fetchguilds',
    once: false,
    async execute(
        socket: Socket & { guilds: WebGuild[] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: (cb: Record<string, any>) => void,
        token?: string,
    ): Promise<void> {
        const { client } = await import('#src/main');
        if (socket.guilds) {
            return callback({
                status: 'success',
                guilds: socket.guilds.map((guild): WebGuild => {
                    guild.botInGuild = !!client.guilds.cache.get(guild.id);
                    const player =
                        guild.botInGuild &&
                        client.music.players.cache.get(guild.id);
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
                version: version.version,
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
            guild.botInGuild = !!client.guilds.cache.get(guild.id);
            const player =
                guild.botInGuild && client.music.players.cache.get(guild.id);
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
                const guild = await QuaverGuild.wrap(
                    client.guilds.cache.get(webGuild.id),
                );
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
                    const whitelisted = await guild.features.checkWhitelisted(
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
        return callback({
            status: 'success',
            guilds: webGuilds,
            version: version.version,
        });
    },
};
