import type { APIGuild, Snowflake } from 'discord.js';
import type { Socket } from 'socket.io';
import {
    QuaverGuild,
    type WhitelistedFeatures,
    WhitelistStatus,
} from '#src/lib/guild';
import { data } from '#src/lib/util/common';
import type { QuaverSong } from '#src/lib/util/common.d';
import { settings } from '#src/lib/util/settings';
import { version } from '#src/lib/util/version';

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
        const { client } = await import('#src/main');
        if (!socket.guilds) return callback({ status: 'error-auth' });
        if (!socket.guilds.find((guild): boolean => guild.id === guildId)) {
            return callback({ status: 'error-auth' });
        }
        if (!client.guilds.cache.get(guildId)) {
            return callback({ status: 'error-generic' });
        }
        let response;
        switch (item) {
            case 'player': {
                const player = await client.music.players.fetch(guildId);
                if (player?.queue.current) {
                    const user = client.users.cache.get(
                        player.queue.current.requesterId,
                    );
                    player.queue.current.requesterTag = user?.tag;
                    player.queue.current.requesterAvatar = user?.avatar;
                }
                response = player
                    ? {
                          queue: player.queue.tracks.map(
                              (track: QuaverSong): QuaverSong => {
                                  const user = client.users.cache.get(
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
                              bassboost: player.memory.bassboost,
                              nightcore: player.memory.nightcore,
                          },
                          paused: player.paused,
                          playing: {
                              track: player.queue.current,
                              elapsed: player.position ?? 0,
                              duration: player.queue.current
                                  ? player.queue.current.info.length
                                  : 0,
                              skip: player.memory.skip,
                              nothingPlaying:
                                  !player.queue.current ||
                                  (!player.playing && !player.paused),
                          },
                          timeout: player.timeout.standard
                              ? player.timeout.end
                              : false,
                          pauseTimeout: player.timeout.pause
                              ? player.timeout.end
                              : false,
                          textChannel: player.queue.channel.name,
                          channel:
                              client.guilds.cache.get(guildId).members.me.voice
                                  .channel?.name,
                      }
                    : null;
                break;
            }
            case 'settings': {
                const guild = await QuaverGuild.wrap(
                    client.guilds.cache.get(guildId),
                );
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
                    const whitelisted = await guild.features.checkWhitelisted(
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
        return callback({
            status: 'success',
            response,
            version: version.version,
        });
    },
};
