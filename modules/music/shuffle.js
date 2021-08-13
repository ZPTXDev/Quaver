module.exports.commands = ["shuffle"];
module.exports.usage = "%cmd%";
module.exports.description = "Shuffle the queue.";
module.exports.action = async function action (details) {
    if (!details["guild"]) {
        return "guild";
    }
    let result = common(details["message"].channel.guild.id, details["message"].author.id);
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
            description: "Shuffled the queue successfully.",
            color: 0xf39bff
        }
    });
    return true;
}

module.exports.slash = {
    name: "shuffle",
    description: module.exports.description,
    deferEphemeral: false,
    guildOnly: true
}
module.exports.slashAction = async function slashAction(ctx) {
    let result = common(ctx.guildID, ctx.user.id);
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
                description: "Shuffled the queue successfully.",
                color: 0xf39bff
            }
        ]
    });
    return;
}

function common(guildId, userId) {
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
            code: "There aren't enough tracks in the queue to perform a shuffle."
        };
    }
    let currentlyPlaying = musicGuilds[guildId].queue[0];
    let cleanQueue = musicGuilds[guildId].queue.slice(1);
    let currentIndex = cleanQueue.length,  randomIndex;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [cleanQueue[currentIndex], cleanQueue[randomIndex]] = [cleanQueue[randomIndex], cleanQueue[currentIndex]];
    }
    musicGuilds[guildId].queue = [currentlyPlaying].concat(cleanQueue);
    return {
        errored: false,
        code: "SUCCESS"
    };
}