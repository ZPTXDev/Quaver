import { REST } from "discord.js"
import { settingsJson } from "./configHandler.js"

export const rest = new REST({ version: "10" }).setToken(settingsJson.token);
