// To be run once.

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { applicationId, token } = require('./settings.json');

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	const data = await rest.get(Routes.applicationGuildCommands(applicationId));
	const promises = [];
	for (const command of data) {
		const deleteUrl = `${Routes.applicationGuildCommands(applicationId)}/${command.id}`;
		promises.push(rest.delete(deleteUrl));
	}
	return Promise.all(promises);
})();