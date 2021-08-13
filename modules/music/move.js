const { CommandOptionType } = require("slash-create");

module.exports.commands = ["move", "m"];
module.exports.usage = "%cmd% position1 position2";
module.exports.description = "Move a track in the queue.";
module.exports.action = async function action (details) {
    if (!details["guild"]) {
        return "guild";
    }
    if (!details["body"]) {
        return "usage";
    }
    let params = details["body"].split(" ");
    if (params.length !== 2 || isNaN(parseInt(params[0])) || isNaN(parseInt(params[1]))) {
        return "usage";
    }
    let result = common(details["message"].channel.guild.id, details["message"].author.id, parseInt(params[0]), parseInt(params[1]));
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
            description: `Moved **[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})** from position **${result.originalPosition}** to position **${result.newPosition}**`,
            color: 0xf39bff
        }
    });
    return true;
}

module.exports.slash = {
    name: "move",
    description: module.exports.description,
    deferEphemeral: false,
    options: [
        {
            name: "position1",
            description: "The position of the track to move.",
            required: true,
            type: CommandOptionType.INTEGER
        },
        {
            name: "position2",
            description: "The position to move the track to.",
            required: true,
            type: CommandOptionType.INTEGER
        }
    ],
    guildOnly: true
}
module.exports.slashAction = async function slashAction(ctx) {
    let result = common(ctx.guildID, ctx.user.id, ctx.options["position1"], ctx.options["position2"]);
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
                description: `Moved **[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})** from position **${result.originalPosition}** to position **${result.newPosition}**`,
                color: 0xf39bff
            }
        ]
    });
    return;
}

function common(guildId, userId, pos1, pos2) {
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
    if (musicGuilds[guildId].queue.length <= 2) {
        return {
            errored: true,
            code: "There aren't enough tracks in the queue to perform a move."
        };
    }
    // This queue length removes the first track ("playing")
    let queueLength = musicGuilds[guildId].queue.length - 1;
    if (pos1 < 1 || pos2 < 1 || pos1 > queueLength || pos2 > queueLength) {
        return {
            errored: true,
            code: "One (or both) of your arguments are out of range."
        };
    }
    if (pos1 === pos2) {
        return {
            errored: true,
            code: "Both of your arguments are the same."
        };
    }
    musicGuilds[guildId].queue.splice(pos2, 0, musicGuilds[guildId].queue.splice(pos1, 1)[0]);
    let track = musicGuilds[guildId].queue[pos2];
    return {
        errored: false,
        code: "SUCCESS",
        track: track,
        originalPosition: pos1,
        newPosition: pos2
    };
}