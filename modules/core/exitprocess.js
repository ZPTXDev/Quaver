module.exports.commands = ["exitprocess"];
module.exports.usage = "%cmd%";
module.exports.description = "Stop Quaver gracefully.";
module.exports.action = function (details) {
    const { settings, musicData, bot } = require("../../main.js");
    const { musicGuilds } = require("../music/util.js");
    const managers = settings.get("managers");
    if (!managers.includes(details["message"].author.id)) {
        return "manager";
    }
    console.log("[!] Gracefully stopping Quaver")
    details["message"].channel.createMessage({
        messageReference: {messageID: details["message"].id},
        embed: {
            description: "Gracefully stopping Quaver",
            color: 0xf39bff
        }
    }).finally(async () => {
        for (const guildId of Object.keys(musicGuilds)) {
            await musicGuilds[guildId].channel.createMessage({
                embed: {
                    description: "Quaver is restarting and will resume your track momentarily.",
                    color: 0xf39bff
                }
            });
            let currentPosition = bot.voiceConnections.get(guildId).paused ? Math.min(bot.voiceConnections.get(guildId).state.position, musicGuilds[guildId].queue[0].info.length) : Math.min(bot.voiceConnections.get(guildId).state.position + (Date.now() - bot.voiceConnections.get(guildId).state.time), musicGuilds[guildId].queue[0].info.length);
            musicGuilds[guildId].currentPosition = currentPosition;
            musicData.set(guildId, musicGuilds[guildId]);
        }
        process.exit(0);
    });
    return true;
}