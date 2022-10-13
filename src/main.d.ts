export type QuaverEvent = {
    name: string;
    once: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute(...args: any[]): void | Promise<void>;
};
