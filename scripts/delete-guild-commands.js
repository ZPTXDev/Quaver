import { Routes } from "discord.js";
import { rest } from "./modules/restHandler.js";
import { settingsJson, guildIds } from "./modules/configHandler.js"

if (guildIds.length === 0) {
    console.error("Unable to delete application guild commands. No guildIds provided.")
    process.exit(1)
}

const clientId = settingsJson.applicationId

async function deleteCommands(guildId) {
    const applicationGuildCommandsRoute = Routes.applicationGuildCommands(clientId, guildId);
    try {
        const applicationGuildCommands = await rest.get(applicationGuildCommandsRoute);
        console.log(`[G ${guildId} | U ${clientId}] Concurrently deleting ${applicationGuildCommands.length} application guild commands...`);
        await Promise.all(
            responseData.map(async function (command) {
                console.log(`[G ${guildId} | U ${clientId}] Deleting command: ${command.id} (${command.name})`);
                return await rest.delete(`${applicationGuildCommandsRoute}/${command.id}`);
            }),
        );
        console.log(`[G ${guildId} | U ${clientId}] Successfully deleted ${applicationGuildCommands.length} application guild commands.`);
    } catch (error) {
        console.error(`[G ${guildId} | U ${clientId}] Failed to delete application guild commands:\n${error.message}\n${error.stack}`);
    }
}

await Promise.all(guildIds.map(deleteCommands));
