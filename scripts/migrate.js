// Running this will migrate your data.json to the new database.sqlite.
import Keyv from 'keyv';
import { set } from 'lodash-es';
import { resolve } from 'path';
import data from '../data.json';
import { rootSettingsJson } from './modules/configHandler.js'
import { getDirname } from "./modules/fileUtils.js";

const database = rootSettingsJson.database
const dirname = getDirname(import.meta.url)
const keyv = new Keyv(database ? `${database.protocol}://${resolve(dirname, '..', database.path)}` : `sqlite://${resolve(dirname, '..', 'database.sqlite')}`, { namespace: 'guild' });

(async () => {
	for (const [guildId, guildData] of Object.entries(data)) {
		const newGuildData = {};
		if (guildData.locale) set(newGuildData, 'settings.locale', guildData.locale);
		if (guildData['247']?.whitelisted) set(newGuildData, 'features.stay.whitelisted', guildData['247'].whitelisted);
		if (guildData.always?.enabled) set(newGuildData, 'settings.stay.enabled', guildData.always.enabled);
		if (guildData.always?.channel) set(newGuildData, 'settings.stay.channel', guildData.always.channel);
		if (guildData.always?.text) set(newGuildData, 'settings.stay.text', guildData.always.text);
		await keyv.set(guildId, newGuildData);
	}
	console.log('Migration complete. You may now delete data.json.');
})();
