// To be run once.
// Commands are deployed globally by default.
// This means that it may take a little bit of time before your commands can be seen on all guilds.

const fs = require('fs'), path = require('path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { applicationId, token } = require('#settings');

const commands = [];
const commandFiles = fs.readdirSync(path.join(__dirname, '..', 'src', 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(path.join(__dirname, '..', 'src', 'commands', file));
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
