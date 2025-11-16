import type { APIGuild, Snowflake } from 'discord.js';
import type { Socket } from 'socket.io';

export default {
    name: 'join',
    once: false,
    async execute(
        socket: Socket & { focused: Snowflake; guilds: APIGuild[] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: (cb: Record<string, any>) => void,
        guildId: Snowflake,
    ): Promise<void> {
        const { client } = await import('#src/main');
        if (!socket.guilds?.find((guild): boolean => guild.id === guildId)) {
            return callback({ status: 'error-auth' });
        }
        if (!client.guilds.cache.get(guildId)) {
            return callback({ status: 'error-generic' });
        }
        if (socket.focused) socket.leave(`guild:${socket.focused}`);
        socket.focused = guildId;
        socket.join(`guild:${guildId}`);
        return callback({ status: 'success' });
    },
};
