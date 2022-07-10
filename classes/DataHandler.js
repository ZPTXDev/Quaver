const Keyv = require('keyv');
const _ = require('lodash');

module.exports = class DataHandler {
	constructor(opts) {
		this.cache = new Keyv({
			uri: opts.cache,
			namespace: opts.namespace,
		});
	}

	async get(key, item) {
		const data = await this.cache.get(key);
		return _.get(data, item);
	}

	async set(key, item, value) {
		let data = await this.cache.get(key);
		if (!data) data = {};
		return await this.cache.set(key, _.set(data, item, value));
	}

	get instance() {
		return this.cache;
	}
};
