const _ = require('lodash');

module.exports = class DataHandler {
	constructor(instance) {
		this.cache = instance;
	}

	async get(key, item) {
		const data = await this.cache.get(key);
		return _.get(data, item);
	}

	async set(key, item, value) {
		let data = await this.cache.get(key);
		if (!data) data = {};
		return _.set(data, item, value);
	}

	get iterator() {
		return this.cache.iterator;
	}
};
