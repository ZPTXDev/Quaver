import Keyv from 'keyv';
import { get as _get, set as _set } from 'lodash-es';

/** Class for handling data through Keyv. */
export default class DataHandler {
	/**
	 * Create an instance of DataHandler, also creating a database connection.
	 * @param {{cache: string, namespace: string}} opts The options to pass to Keyv.
	 */
	constructor(opts) {
		this.cache = new Keyv({
			uri: opts.cache,
			namespace: opts.namespace,
		});
	}

	/**
	 * Get an item from the database by its key.
	 * @param {string} key The key.
	 * @param {string} item The item to retrieve.
	 * @returns {Promise<string|boolean|undefined>} The requested item.
	 */
	async get(key, item) {
		/** @type {Object} */
		const data = await this.cache.get(key);
		return _get(data, item);
	}

	/**
	 * Set an item in the database by its key.
	 * @param {string} key The key.
	 * @param {string} item The item to set.
	 * @param {Object} value The value to set.
	 * @returns {Promise<true>} The updated item.
	 */
	async set(key, item, value) {
		/** @type {Object} */
		let data = await this.cache.get(key);
		if (!data) data = {};
		return await this.cache.set(key, _set(data, item, value));
	}

	/**
	 * Get the Keyv instance used by this DataHandler.
	 * @returns {Keyv} The Keyv instance.
	 */
	get instance() {
		return this.cache;
	}
}
