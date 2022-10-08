// To be run once.

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { token, applicationId } from '../dist/settings.js';

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
	const data = await rest.get(Routes.applicationCommands(applicationId));
	const promises = [];
	for (const command of data) {
		const deleteUrl = `${Routes.applicationCommands(applicationId)}/${command.id}`;
		promises.push(rest.delete(deleteUrl));
	}
	return Promise.all(promises);
})();
