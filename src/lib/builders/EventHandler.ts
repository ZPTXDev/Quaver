import type { ClientEvents } from 'discord.js';
import { BaseHandler, type GenericExecuteFunction } from '.';

type GenericEventExecuteFunction<K extends keyof ClientEvents> = (
    this: EventHandler<K>,
    ...args: ClientEvents[K]
) => Promise<void> | void;

export type AcceptedEventTypes = keyof ClientEvents | string | symbol;

export class EventHandler<E extends AcceptedEventTypes> extends BaseHandler {
    once = false;
    execute: GenericEventExecuteFunction<keyof ClientEvents>;

    /**
     * Set whether this event handler should only be called once.
     * @param once - Whether this event handler should only be called once.
     * @returns This instance for chaining.
     */
    setOnce(once: boolean): this {
        this.once = once;
        return this;
    }

    /**
     * Sets the event for this handler.
     * @param _event - The event.
     * @returns This instance for chaining.
     */
    setEvent<K extends keyof ClientEvents>(_event: K): EventHandler<K> {
        const newInstance = new EventHandler<K>();
        newInstance.once = this.once;
        if (this.execute) newInstance.execute = this.execute.bind(newInstance);
        return newInstance;
    }

    setExecute(
        execute: E extends keyof ClientEvents
            ? GenericEventExecuteFunction<E>
            : GenericExecuteFunction,
    ): this {
        this.execute = execute.bind(this);
        return this;
    }

    validate(): boolean {
        return (
            typeof this.once === 'boolean' && typeof this.execute === 'function'
        );
    }
}
