import type { QuaverPlayer } from '#src/lib/util/common.d.js';

export default {
    name: 'timer',
    once: false,
    async execute(): Promise<void> {
        const { bot, io } = await import('#src/main.js');
        bot.music.players.cache.forEach((player: QuaverPlayer): void => {
            if (!player.queue?.current) return;
            const user = bot.users.cache.get(player.queue.current.requesterId);
            player.queue.current.requesterTag = user?.tag;
            player.queue.current.requesterAvatar = user?.avatar;
            io.to(`guild:${player.id}`).emit('intervalTrackUpdate', {
                elapsed: player.position ?? 0,
                duration: player.queue.current.info.length,
                track: player.queue.current,
                skip: player.skip,
                nothingPlaying:
                    !player.queue.current ||
                    (!player.playing && !player.paused),
            });
        });
    },
};
