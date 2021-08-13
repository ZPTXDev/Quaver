const { CommandOptionType } = require("slash-create");

module.exports.commands = ["loop"];
module.exports.usage = "%cmd% [true|false]";
module.exports.description = "Queue looping.";
module.exports.action = async function action (details) {
    if (!details["guild"]) {
        return "guild";
    }
    if (details["body"] !== "" && !["true", "false"].includes(details["body"])) {
        return "usage";
    }
    let result = common(details["message"].channel.guild.id, details["message"].author.id, details["body"]);
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
            description: `Queue looping **${result.looped ? "enabled" : "disabled"}**`,
            color: 0xf39bff
        }
    });
    return true;
}

module.exports.slash = {
    name: "loop",
    description: module.exports.description,
    deferEphemeral: false,
    options: [
        {
            name: "loop",
            description: "To enable or disable the queue loop. If not specified, it will be toggled instead.",
            type: CommandOptionType.BOOLEAN
        }
    ],
    guildOnly: true
}
module.exports.slashAction = async function slashAction(ctx) {
    let result = common(ctx.guildID, ctx.user.id, "loop" in ctx.options ? ctx.options["loop"].toString() : "");
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
                description: `Queue looping **${result.looped ? "enabled" : "disabled"}**`,
                color: 0xf39bff
            }
        ]
    });
    return;
}

function common(guildId, userId, override) {
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
    let newLooped = !musicGuilds[guildId].loop;
    if (override === "true") {
        newLooped = true;
    }
    else if (override === "false") {
        newLooped = false;
    }
    musicGuilds[guildId].loop = newLooped;
    return {
        errored: false,
        code: "SUCCESS",
        looped: newLooped
    };
}