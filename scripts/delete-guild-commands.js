import { Routes } from 'discord.js';
import { rest } from './modules/restHandler.js';
import { rootSettingsJson } from './modules/configHandler.js';
import scriptSettingsJson from './settings.json' with { type: 'json' };

const guildIds = scriptSettingsJson.guildIds;
if (guildIds.length === 0) {
    console.error('No guild ID(s) to process.');
    process.exit(1);
}

const clientId = rootSettingsJson.applicationId;

async function deleteCommands(guildId) {
    const applicationGuildCommandsRoute = Routes.applicationGuildCommands(clientId, guildId);
    try {
        const applicationGuildCommands = await rest.get(applicationGuildCommandsRoute);
        console.log(`[G ${guildId} | U ${clientId}] Concurrently deleting ${applicationGuildCommands.length} application guild commands...`);
        const deletedCommands = await Promise.all(
            applicationGuildCommands.map(async function(command) {
                const commandId = command.id;
                console.log(`[G ${guildId} | U ${clientId}] Deleting command: ${commandId} (${command.name})`);
                return await rest.delete(`${applicationGuildCommandsRoute}/${commandId}`);
            }),
        );
        console.log(`[G ${guildId} | U ${clientId}] Successfully deleted ${deletedCommands.length} application guild commands.`);
    } catch (error) {
        console.error(`[G ${guildId} | U ${clientId}] Failed to delete application guild commands:\n${error.message}\n${error.stack}`);
    }
}

await Promise.all(guildIds.map(deleteCommands));
