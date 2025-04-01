import { Routes } from "discord.js";
import { rest } from "./modules/restHandler.js"
import { getJsonCommands } from "./modules/jsonCommands.js";
import { settingsJson } from "./modules/configHandler.js"
import { getLocalesMap } from "./modules/localesMap.js";
import { setLocales } from "../dist/lib/util/common.js";

const clientId = settingsJson.applicationId

const localesMap = await getLocalesMap();
setLocales(localesMap)

const commands = await getJsonCommands();
const applicationGlobalCommandsRoute = Routes.applicationCommands(clientId);

try {
    console.warn("Warning: Application global commands should only be registered once. The changes may take time to propagate across all guilds.");
    console.log(`[GLOBAL | U ${clientId}] Registering ${commands.length} application global commands...`);
    const applicationGlobalCommands = await rest.put(applicationGlobalCommandsRoute, { body: commands });
    console.log(`[GLOBAL | U ${clientId}] Successfully registered ${applicationGlobalCommands.length} application global commands.`);
} catch (error) {
    console.error(error);
    process.exit(1);
}
