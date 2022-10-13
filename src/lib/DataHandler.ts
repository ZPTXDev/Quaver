import Keyv from 'keyv';
import { get as _get, set as _set } from 'lodash-es';
import type { DatabaseObject } from './DataHandler.d.js';

/** Class for handling data through Keyv. */
export default class DataHandler {
	cache: Keyv;

	/**
	 * Create an instance of DataHandler, also creating a database connection.
	 * @param opts - The options to pass to Keyv.
	 */
	constructor(opts: { cache: string; namespace: string; }) {
		this.cache = new Keyv({
			uri: opts.cache,
			namespace: opts.namespace,
		});
	}

	/**
	 * Get an item from the database by its key.
	 * @param key - The key.
	 * @param item - The item to retrieve.
	 * @returns The requested item.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async get<T>(key: string, item: string): Promise<T | undefined> {
		const data: DatabaseObject = await this.cache.get(key);
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
	async set(key: string, item: string, value: string | boolean): Promise<true> {
		let data: DatabaseObject = await this.cache.get(key);
		if (!data) data = {};
		return this.cache.set(key, _set(data, item, value));
	}

	/**
	 * Get the Keyv instance used by this DataHandler.
	 * @returns The Keyv instance.
	 */
	get instance(): Keyv {
		return this.cache;
	}
}
