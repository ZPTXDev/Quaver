// To be run once.
// Commands are deployed globally by default.
// This means that it may take a little bit of time before your commands can be seen on all guilds.

import { REST } from '@discordjs/rest';
import { getAbsoluteFileURL } from '@zptxdev/zptx-lib';
import { Routes } from 'discord-api-types/v10';
import { Collection } from 'discord.js';
import { readdirSync } from 'fs';
import { setLocales } from '../dist/lib/util/common.js';
import settings from '../settings.json' assert { type: 'json' };

const locales = new Collection();
const localeFolders = readdirSync(getAbsoluteFileURL(import.meta.url, ['..', 'locales']));
for await (const folder of localeFolders) {
	const localeFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['..', 'locales', folder]));
	const localeProps = {};
	for await (const file of localeFiles) {
		const categoryProps = await import(getAbsoluteFileURL(import.meta.url, ['..', 'locales', folder, file]));
		const categoryName = file.split('.')[0].toUpperCase();
		localeProps[categoryName] = categoryProps.default;
	}
	locales.set(folder, localeProps);
}
setLocales(locales);

const commands = [];
const commandFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['..', 'dist', 'commands'])).filter(file => file.endsWith('.js'));

for await (const file of commandFiles) {
	const command = await import(getAbsoluteFileURL(import.meta.url, ['..', 'dist', 'commands', file]));
	commands.push(command.default.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(settings.token);

try {
	await rest.put(
		Routes.applicationCommands(settings.applicationId),
		{ body: commands },
	);
	console.log('Successfully registered application commands.');
	process.exit(0);
}
catch (error) {
	console.error(error);
	process.exit(1);
}
