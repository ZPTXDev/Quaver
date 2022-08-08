// To be run once.

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { token, applicationId } from '#settings';

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	const data = await rest.get(Routes.applicationCommands(applicationId));
	const promises = [];
	for (const command of data) {
		const deleteUrl = `${Routes.applicationCommands(applicationId)}/${command.id}`;
		promises.push(rest.delete(deleteUrl));
	}
	return Promise.all(promises);
})();
