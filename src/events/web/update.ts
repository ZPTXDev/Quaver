import type { QuaverPlayer } from '#src/lib/util/common.d.js';
import type { Song } from '@lavaclient/queue';
import type { APIGuild, APIUser, Snowflake } from 'discord.js';
import type { Socket } from 'socket.io';
import type { UpdateItemTypes } from './update.d.js';

export default {
    name: 'update',
    once: false,
    async execute(
        socket: Socket & { guilds: APIGuild[]; user: APIUser },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: (cb: Record<string, any>) => void,
        guildId: Snowflake,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        item: { type: UpdateItemTypes; value?: any },
    ): Promise<void> {
        const { bot, io } = await import('#src/main.js');
        if (!socket.guilds) return callback({ status: 'error-auth' });
        if (!socket.guilds.find((guild): boolean => guild.id === guildId)) {
            return callback({ status: 'error-auth' });
        }
        if (
            bot.guilds.cache.get(guildId)?.members.cache.get(socket.user.id)
                ?.voice.channelId !==
            bot.guilds.cache.get(guildId).members.me.voice.channelId
        ) {
            return callback({ status: 'error-generic' });
        }
        switch (item.type) {
            case 'loop': {
                const player = bot.music.players.get(guildId);
                if (!player) return callback({ status: 'error-generic' });
                player.queue.setLoop(item.value);
                io.to(`guild:${guildId}`).emit('loopUpdate', item.value);
                break;
            }
            case 'volume': {
                const player = bot.music.players.get(guildId);
                if (!player) return callback({ status: 'error-generic' });
                player.setVolume(item.value);
                io.to(`guild:${guildId}`).emit('volumeUpdate', item.value);
                break;
            }
            case 'paused': {
                const player = bot.music.players.get(guildId);
                if (!player) return callback({ status: 'error-generic' });
                player.pause(item.value);
                io.to(`guild:${guildId}`).emit('pauseUpdate', item.value);
                break;
            }
            case 'skip': {
                const player = bot.music.players.get(guildId) as QuaverPlayer;
                if (!player) return callback({ status: 'error-generic' });
                if (player.queue.current.requester === socket.user.id) {
                    await player.queue.skip();
                    await player.queue.start();
                    break;
                }
                const skip = player.skip ?? {
                    required: Math.ceil(
                        bot.guilds.cache
                            .get(guildId)
                            .members.me.voice.channel.members.filter(
                                (m): boolean => !m.user.bot,
                            ).size / 2,
                    ),
                    users: [],
                };
                if (skip.users.includes(socket.user.id)) {
                    return callback({ status: 'error-generic' });
                }
                skip.users.push(socket.user.id);
                if (skip.users.length >= skip.required) {
                    await player.queue.skip();
                    await player.queue.start();
                    break;
                }
                player.skip = skip;
                break;
            }
            case 'bassboost': {
                const player = bot.music.players.get(guildId) as QuaverPlayer;
                if (!player) return callback({ status: 'error-generic' });
                let eqValues: number[] = Array(15).fill(0);
                if (item.value) {
                    eqValues = [
                        0.2,
                        0.15,
                        0.1,
                        0.05,
                        0.0,
                        ...new Array(10).fill(-0.05),
                    ];
                }
                // i don't get it, if this breaks something we know where to look
                await player.setEqualizer(...eqValues);
                player.bassboost = item.value;
                io.to(`guild:${guildId}`).emit('filterUpdate', {
                    bassboost: player.bassboost,
                    nightcore: player.nightcore,
                });
                break;
            }
            case 'nightcore': {
                const player = bot.music.players.get(guildId) as QuaverPlayer;
                if (!player) return callback({ status: 'error-generic' });
                player.filters.timescale = item.value
                    ? { speed: 1.125, pitch: 1.125, rate: 1 }
                    : undefined;
                await player.setFilters();
                player.nightcore = item.value;
                io.to(`guild:${guildId}`).emit('filterUpdate', {
                    bassboost: player.bassboost,
                    nightcore: player.nightcore,
                });
                break;
            }
            case 'seek': {
                const player = bot.music.players.get(guildId);
                if (!player) return callback({ status: 'error-generic' });
                if (player.queue.current.requester !== socket.user.id) {
                    return callback({ status: 'error-auth' });
                }
                await player.seek(item.value);
                break;
            }
            case 'remove': {
                const player = bot.music.players.get(guildId);
                if (!player) return callback({ status: 'error-generic' });
                player.queue.remove(item.value);
                io.to(`guild:${guildId}`).emit(
                    'queueUpdate',
                    player.queue.tracks.map(
                        (
                            t: Song & { requesterTag: string },
                        ): Song & { requesterTag: string } => {
                            t.requesterTag = bot.users.cache.get(
                                t.requester,
                            )?.tag;
                            return t;
                        },
                    ),
                );
                break;
            }
            case 'shuffle': {
                const player = bot.music.players.get(guildId);
                if (!player) return callback({ status: 'error-generic' });
                let currentIndex = player.queue.tracks.length,
                    randomIndex;
                while (currentIndex !== 0) {
                    randomIndex = Math.floor(Math.random() * currentIndex);
                    currentIndex--;
                    [
                        player.queue.tracks[currentIndex],
                        player.queue.tracks[randomIndex],
                    ] = [
                        player.queue.tracks[randomIndex],
                        player.queue.tracks[currentIndex],
                    ];
                }
                io.to(`guild:${player.guildId}`).emit(
                    'queueUpdate',
                    player.queue.tracks.map(
                        (
                            t: Song & { requesterTag: string },
                        ): Song & { requesterTag: string } => {
                            t.requesterTag = bot.users.cache.get(
                                t.requester,
                            )?.tag;
                            return t;
                        },
                    ),
                );
                break;
            }
        }
        return callback({ status: 'success' });
    },
};
