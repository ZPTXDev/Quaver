// To be run once.
// Commands are deployed globally by default.
// This means that it may take a little bit of time before your commands can be seen on all guilds.

import { readdirSync } from 'fs';
import { join } from 'path';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { applicationId, token } from '#settings';

const commands = [];
const commandFiles = readdirSync(join(__dirname, '..', 'src', 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(join(__dirname, '..', 'src', 'commands', file));
	commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	try {
		await rest.put(
			Routes.applicationCommands(applicationId),
			{ body: commands },
		);
		console.log('Successfully registered application commands.');
	}
	catch (error) {
		console.error(error);
	}
})();
