import type { NodeEvents } from 'lavaclient';

export type QuaverMusicEvent = {
    name: keyof NodeEvents;
    once: boolean;
    execute<K extends NodeEvents>(...args: NodeEvents[K]): void | Promise<void>;
};
