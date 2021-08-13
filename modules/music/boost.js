const { CommandOptionType } = require("slash-create");

module.exports.commands = ["boost"];
module.exports.usage = "%cmd% [true|false]";
module.exports.description = "Bass boost for your music.";
module.exports.action = async function action (details) {
    if (!details["guild"]) {
        return "guild";
    }
    if (details["body"] !== "" && !["true", "false"].includes(details["body"])) {
        return "usage";
    }
    let result = await common(details["message"].channel.guild.id, details["message"].author.id, details["body"]);
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
            description: `Bass boost **${result.boosted ? "enabled" : "disabled"}**`,
            color: 0xf39bff
        }
    });
    return true;
}

module.exports.slash = {
    name: "boost",
    description: module.exports.description,
    deferEphemeral: false,
    options: [
        {
            name: "boost",
            description: "To enable or disable the boost. If not specified, it will be toggled instead.",
            type: CommandOptionType.BOOLEAN
        }
    ],
    guildOnly: true
}
module.exports.slashAction = async function slashAction(ctx) {
    let result = await common(ctx.guildID, ctx.user.id, "boost" in ctx.options ? ctx.options["boost"].toString() : "");
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
                description: `Bass boost **${result.boosted ? "enabled" : "disabled"}**`,
                color: 0xf39bff
            }
        ]
    });
    return;
}

async function common(guildId, userId, override) {
    const { bot } = require("../../main.js");
    const { musicGuilds, getPlayer } = require("./util.js");
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
    let player = await getPlayer(musicGuilds[guildId].voice);
    let newBoosted = !musicGuilds[guildId].boost;
    if (override === "true") {
        newBoosted = true;
    }
    else if (override === "false") {
        newBoosted = false;
    }
    let eqValues = [
        {"band": 0, "gain": 0},
        {"band": 1, "gain": 0},
        {"band": 2, "gain": 0},
        {"band": 3, "gain": 0},
        {"band": 4, "gain": 0},
        {"band": 5, "gain": 0}
    ];
    if (newBoosted) {
        eqValues = [
            {"band": 0, "gain": -0.1},
            {"band": 1, "gain": 0.14},
            {"band": 2, "gain": 0.32},
            {"band": 3, "gain": 0.6},
            {"band": 4, "gain": -1},
            {"band": 5, "gain": 0.22}
        ];
    }
    await player.sendEvent({op: 'equalizer', guildId: this.guildId, bands: eqValues});
    musicGuilds[guildId].boost = newBoosted;
    return {
        errored: false,
        code: "SUCCESS",
        boosted: newBoosted
    };
}