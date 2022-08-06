// Running this will migrate your data.json to the new database.sqlite.
const Keyv = require('keyv');
const _ = require('lodash');
const data = require('../data.json');
const { database_uri } = require('#settings');

const keyv = new Keyv(database_uri ?? 'sqlite://database.sqlite', { namespace: 'guild' });

(async () => {
	for (const [guildId, guildData] of Object.entries(data)) {
		const newGuildData = {};
		if (guildData.locale) _.set(newGuildData, 'settings.locale', guildData.locale);
		if (guildData['247']?.whitelisted) _.set(newGuildData, 'features.stay.whitelisted', guildData['247'].whitelisted);
		if (guildData.always?.enabled) _.set(newGuildData, 'settings.stay.enabled', guildData.always.enabled);
		if (guildData.always?.channel) _.set(newGuildData, 'settings.stay.channel', guildData.always.channel);
		if (guildData.always?.text) _.set(newGuildData, 'settings.stay.text', guildData.always.text);
		await keyv.set(guildId, newGuildData);
	}
	console.log('Migration complete. You may now delete data.json.');
})();
