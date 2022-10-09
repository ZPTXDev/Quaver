// To be run once.

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import settings from '../settings.json' assert { type: 'json' };

const rest = new REST({ version: '10' }).setToken(settings.token);

(async () => {
	const data = await rest.get(Routes.applicationCommands(settings.applicationId));
	const promises = [];
	for (const command of data) {
		const deleteUrl = `${Routes.applicationCommands(settings.applicationId)}/${command.id}`;
		promises.push(rest.delete(deleteUrl));
	}
	return Promise.all(promises);
})();
