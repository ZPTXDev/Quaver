module.exports.commands = ["disconnect", "dc"];
module.exports.usage = "%cmd%";
module.exports.description = "Disconnect the bot.";
module.exports.action = async function action (details) {
    if (!details["guild"]) {
        return "guild";
    }
    let result = await common(details["message"].channel.guild.id, details["message"].author.id);
    if (result.errored) {
        details["message"].channel.createMessage({
            messageReference: {messageID: details["message"].id},
            embed: {
                description: result.code,
                color: 0xf39bff
            }
        });
        return true;
    }
    details["message"].channel.createMessage({
        messageReference: {messageID: details["message"].id},
        embed: {
            description: "Disconnected successfully.",
            color: 0xf39bff
        }
    });
    return true;
}

module.exports.slash = {
    name: "disconnect",
    description: module.exports.description,
    deferEphemeral: false,
    guildOnly: true
}
module.exports.slashAction = async function slashAction(ctx) {
    let result = await common(ctx.guildID, ctx.user.id);
    if (result.errored) {
        await ctx.send({
            embeds: [
                {
                    description: result.code,
                    color: 0xf39bff
                }
            ],
            ephemeral: true
        });
        return;
    }
    await ctx.send({
        embeds: [
            {
                description: "Disconnected successfully.",
                color: 0xf39bff
            }
        ]
    });
    return;
}

async function common(guildId, userId) {
    const { bot } = require("../../main.js");
    const { musicGuilds } = require("./util.js");
    if (!bot.guilds.get(guildId).members.get(userId).voiceState.channelID) {
        return {
            errored: true,
            code: "You are not in a voice channel."
        };
    }
    if (guildId in musicGuilds && bot.guilds.get(guildId).members.get(userId).voiceState.channelID != musicGuilds[guildId].voice.id) {
        return {
            errored: true,
            code: "You are not in my voice channel."
        };
    }
    if (!(guildId in musicGuilds)) {
        return {
            errored: true,
            code: "There is no active session in this server."
        };
    }
    if ("timeout" in musicGuilds[guildId]) {clearTimeout(musicGuilds[guildId].timeout);}
    bot.leaveVoiceChannel(musicGuilds[guildId].voice.id);
    delete musicGuilds[guildId];
    return {
        errored: false,
        code: "SUCCESS"
    };
}