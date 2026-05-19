import KeyvSqlite from '@keyv/sqlite';
import { Cacheable } from 'cacheable';
import type { Snowflake } from 'discord.js';
import Keyv from 'keyv';
import { get as _get, set as _set, unset as _unset } from 'lodash-es';

type DatabaseObject = {
    settings?: GuildSettingsObject;
};

type GuildSettingsObject = {
    stay?: StaySettingObject;
    locale?: string;
};

type StaySettingObject = {
    enabled: boolean;
    channel?: Snowflake;
    text?: Snowflake;
};

/** Class for handling data through Keyv. */
export class DataHandler {
    cache: Cacheable;

    /**
     * Create an instance of DataHandler, also creating a database connection.
     * @param opts - The options to pass to Keyv.
     */
    constructor(opts: { cache: string; namespace: string }) {
        this.cache = new Cacheable({
            secondary: new Keyv({
                store: new KeyvSqlite({
                    uri: opts.cache,
                }),
                namespace: opts.namespace,
            }),
            namespace: opts.namespace,
        });
    }

    /**
     * Get an item from the database by its key.
     * @param key - The key.
     * @param item - The item to retrieve.
     * @returns The requested item.
     */
    async get<T>(key: string, item: string): Promise<T | undefined> {
        const data = await this.cache.get<DatabaseObject>(key);
        if (!data) return undefined;
        return _get(data, item);
    }

    /**
     * Set an item in the database by its key.
     * @param key - The key.
     * @param item - The item to set.
     * @param value - The value to set.
     * @returns The updated item.
     */
    async set(
        key: string,
        item: string,
        value: string | number | boolean,
    ): Promise<boolean> {
        let data = await this.cache.get<DatabaseObject>(key);
        if (!data) data = {};
        _set(data, item, value);
        return this.cache.set(key, data);
    }

    /**
     * Unset an item in the database by its key.
     * @param key - The key.
     * @param item - The item to unset.
     * @returns The updated item.
     */
    async unset(key: string, item: string): Promise<boolean> {
        const data = await this.cache.get<DatabaseObject>(key);
        if (!data) return false;
        _unset(data, item);
        return this.cache.set(key, data);
    }

    /**
     * Get the Keyv instance used by this DataHandler.
     * @returns The Keyv instance.
     */
    get instance(): Keyv {
        return this.cache.secondary!;
    }
}
