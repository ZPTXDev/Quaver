const { CommandOptionType } = require("slash-create");

module.exports.commands = ["remove", "r"];
module.exports.usage = "%cmd% position";
module.exports.description = "Remove a track in the queue.";
module.exports.action = async function action (details) {
    if (!details["guild"]) {
        return "guild";
    }
    if (!details["body"] || isNaN(parseInt(details["body"]))) {
        return "usage";
    }
    let result = common(details["message"].channel.guild.id, details["message"].author.id, parseInt(details["body"]));
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
            description: `Removed **[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})**${result.force ? ` by force\nAdded by ${result.track.requester.mention}` : ""}`,
            color: 0xf39bff
        }
    });
    return true;
}

module.exports.slash = {
    name: "remove",
    description: module.exports.description,
    deferEphemeral: false,
    options: [
        {
            name: "position",
            description: "The position of the track to remove.",
            required: true,
            type: CommandOptionType.INTEGER
        }
    ],
    guildOnly: true
}
module.exports.slashAction = async function slashAction(ctx) {
    let result = common(ctx.guildID, ctx.user.id, ctx.options["position"]);
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
                description: `Removed **[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})**${result.force ? ` by force\nAdded by ${result.track.requester.mention}` : ""}`,
                color: 0xf39bff
            }
        ]
    });
    return;
}

function common(guildId, userId, pos) {
    const { bot, getPermsMatch } = require("../../main.js");
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
    if (pos < 1 || pos > musicGuilds[guildId].queue.length - 1) {
        return {
            errored: true,
            code: "Position out of range."
        };
    }
    let force = false;
    let userIsRequester = musicGuilds[guildId].queue[pos].requester.id === userId;
    if (!userIsRequester && getPermsMatch(bot.guilds.get(guildId).members.get(userId).permissions, ["manageGuild"]).length === 0) {
        force = true;
    }
    if (!userIsRequester && !force) {
        return {
            errored: true,
            code: "You are not the requester of that track."
        };
    }
    let track = musicGuilds[guildId].queue[pos];
    musicGuilds[guildId].queue.splice(pos, 1);
    return {
        errored: false,
        code: "SUCCESS",
        track: track,
        force: force
    };
}