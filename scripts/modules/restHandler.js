import { REST } from 'discord.js';
import { rootSettingsJson } from './configHandler.js';

export const rest = new REST({ version: '10' }).setToken(rootSettingsJson.token);
