import { Routes } from 'discord.js';
import { rootSettingsJson } from './configHandler.js';

export const applicationGlobalCommandsRoute = Routes.applicationCommands(rootSettingsJson.applicationId);
