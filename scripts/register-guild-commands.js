import { Routes } from "discord.js";
import { rest } from "./modules/restHandler.js"
import { getJsonCommands } from "./modules/jsonCommands.js";
import { rootSettingsJson, scriptSettingsJson } from "./modules/configHandler.js"
import { getLocalesMap } from "./modules/localesMap.js";
import { setLocales } from "../dist/lib/util/common.js";

if (scriptSettingsJson.guildIds.length === 0) {
    console.error("No guild ID(s) to process.")
    process.exit(1)
}

const clientId = rootSettingsJson.applicationId

const localesMap = await getLocalesMap();
setLocales(localesMap)

const commands = await getJsonCommands();

async function registerCommands(guildId) {
    const applicationGuildCommandsRoute = Routes.applicationGuildCommands(clientId, guildId);
    try {
        console.log(`[G ${guildId} | U ${clientId}] Registering ${commands.length} application guild commands...`);
        const applicationGuildCommands = await rest.put(applicationGuildCommandsRoute, { body: commands });
        console.log(`[G ${guildId} | U ${clientId}] Successfully registered ${applicationGuildCommands.length} application guild commands.`);
    } catch (error) {
        console.error(`[G ${guildId}| U ${clientId}] Failed to register application guild commands:\n${error.message}\n${error.stack}`);
    }
}

await Promise.all(guildIds.map(registerCommands))
