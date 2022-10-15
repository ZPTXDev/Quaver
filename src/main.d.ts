import type { ClientEvents } from 'discord.js';
import type { NodeEvents } from 'lavaclient';

export type QuaverEvent = {
    name: keyof ClientEvents;
    once: boolean;
    execute<K extends keyof ClientEvents>(
        ...args: ClientEvents[K]
    ): void | Promise<void>;
};

export type QuaverMusicEvent = {
    name: keyof NodeEvents;
    once: boolean;
    execute<K extends NodeEvents>(...args: NodeEvents[K]): void | Promise<void>;
};
