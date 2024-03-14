import type {
    QuaverPlayer,
    QuaverSong,
    WhitelistedFeatures,
} from '#src/lib/util/common.d.js';
import { data } from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import {
    WhitelistStatus,
    getGuildFeatureWhitelisted,
} from '#src/lib/util/util.js';
import { version } from '#src/lib/util/version.js';
import type { APIGuild, Snowflake } from 'discord.js';
import type { Socket } from 'socket.io';

export default {
    name: 'request',
    once: false,
    async execute(
        socket: Socket & { guilds: APIGuild[] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: (cb: Record<string, any>) => void,
        guildId: Snowflake,
        item: 'player' | 'settings',
    ): Promise<void> {
        const { bot } = await import('#src/main.js');
        if (!socket.guilds) return callback({ status: 'error-auth' });
        if (!socket.guilds.find((guild): boolean => guild.id === guildId)) {
            return callback({ status: 'error-auth' });
        }
        if (!bot.guilds.cache.get(guildId)) {
            return callback({ status: 'error-generic' });
        }
        let response;
        switch (item) {
            case 'player': {
                const player = (await bot.music.players.fetch(
                    guildId,
                )) as QuaverPlayer;
                if (player?.queue.current) {
                    const user = bot.users.cache.get(
                        player.queue.current.requesterId,
                    );
                    player.queue.current.requesterTag = user?.tag;
                    player.queue.current.requesterAvatar = user?.avatar;
                }
                response = player
                    ? {
                          queue: player.queue.tracks.map(
                              (track: QuaverSong): QuaverSong => {
                                  const user = bot.users.cache.get(
                                      track.requesterId,
                                  );
                                  track.requesterTag = user?.tag;
                                  track.requesterAvatar = user?.avatar;
                                  return track;
                              },
                          ),
                          volume: player.volume,
                          loop: player.queue.loop.type,
                          filters: {
                              bassboost: player.bassboost,
                              nightcore: player.nightcore,
                          },
                          paused: player.paused,
                          playing: {
                              track: player.queue.current,
                              elapsed: player.position ?? 0,
                              duration: player.queue.current
                                  ? player.queue.current.info.length
                                  : 0,
                              skip: player.skip,
                              nothingPlaying:
                                  !player.queue.current ||
                                  (!player.playing && !player.paused),
                          },
                          timeout: player.timeout ? player.timeoutEnd : false,
                          pauseTimeout: player.pauseTimeout
                              ? player.timeoutEnd
                              : false,
                          textChannel: player.queue.channel.name,
                          channel:
                              bot.guilds.cache.get(guildId).members.me.voice
                                  .channel?.name,
                      }
                    : null;
                break;
            }
            case 'settings': {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                response = {} as any;
                for (const feature of [
                    'stay',
                    'autolyrics',
                    'smartqueue',
                ].filter(
                    (feat: WhitelistedFeatures): boolean =>
                        settings.features[feat].enabled,
                )) {
                    response[feature] = {
                        enabled: !!(await data.guild.get<boolean>(
                            guildId,
                            `settings.${feature}${
                                feature === 'stay' ? '.enabled' : ''
                            }`,
                        )),
                        whitelisted: false,
                    };
                    const whitelisted = await getGuildFeatureWhitelisted(
                        guildId,
                        feature as WhitelistedFeatures,
                    );
                    if (
                        ![
                            WhitelistStatus.NotWhitelisted,
                            WhitelistStatus.Expired,
                        ].includes(whitelisted)
                    ) {
                        response[feature].whitelisted = true;
                    }
                }
            }
        }
        return callback({ status: 'success', response, version });
    },
};
