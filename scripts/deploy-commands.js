// To be run once.
// Commands are deployed globally by default.
// This means that it may take a little bit of time before your commands can be seen on all guilds.

import { readdirSync } from 'fs';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { Collection } from 'discord.js';
import { token, applicationId } from '#src/settings.js';
import { getAbsoluteFileURL } from '#src/lib/util/util.js';
import { setLocales } from '#src/lib/util/common.js';

const locales = new Collection();
const localeFolders = readdirSync(getAbsoluteFileURL(import.meta.url, ['..', 'locales']));
for await (const folder of localeFolders) {
	const localeFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['..', 'locales', folder]));
	const localeData = {};
	for await (const file of localeFiles) {
		const locale = await import(getAbsoluteFileURL(import.meta.url, ['..', 'locales', folder, file]));
		localeData[file.split('.')[0].toUpperCase()] = locale.default;
	}
	locales.set(folder, localeData);
}
setLocales(locales);

const commands = [];
const commandFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['..', 'src', 'commands'])).filter(file => file.endsWith('.js'));

for await (const file of commandFiles) {
	const command = await import(getAbsoluteFileURL(import.meta.url, ['..', 'src', 'commands', file]));
	commands.push(command.default.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(token);

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
