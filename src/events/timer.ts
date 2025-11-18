import { EventHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';

// no setEvent call as this event isn't emitted by discord.js
export default new EventHandler().setExecute(async function(): Promise<void> {
    const { client } = await import('#src/main');
    for (const player of client.music.players.cache.values()) {
        if (!player.queue?.current) continue;
        const user = player.client.users.cache.get(
            player.queue.current.requesterId,
        );
        const guild = await QuaverGuild.wrap(player.guild);
        player.queue.current.requesterTag = user?.tag;
        player.queue.current.requesterAvatar = user?.avatar;
        guild.sendWebUpdate('intervalTrackUpdate', {
            elapsed: player.position ?? 0,
            duration: player.queue.current.info.length,
            track: player.queue.current,
            skip: player.memory.skip,
            nothingPlaying:
                !player.queue.current || (!player.playing && !player.paused),
        });
    }
});
