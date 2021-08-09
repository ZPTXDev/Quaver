module.exports.commands = ["playing", "nowplaying", "np"];
module.exports.usage = "%cmd%";
module.exports.description = "Show what's playing right now.";
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
    if (result.track.info.isStream) {
        details["message"].channel.createMessage({
            messageReference: {messageID: details["message"].id},
            embed: {
                description: `**[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})**\n🔴 **LIVE** ▬▬▬▬▬▬▬▬▬▬\n\`[Streaming]\` | Added by ${result.track.requester.mention}`,
                color: 0xf39bff    
            }
        });
        return true;
    }
    details["message"].channel.createMessage({
        messageReference: {messageID: details["message"].id},
        embed: {
            description: `**[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})**\n${result.bar}\n\`[${result.currentProgress} / ${result.fullProgress}]\` | Added by ${result.track.requester.mention}`,
            color: 0xf39bff
        }
    });
    return true;
}

module.exports.slash = {
    name: "playing",
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
    if (result.track.info.isStream) {
        await ctx.send({
            embeds: [
                {
                    description: `**[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})**\n🔴 **LIVE** ▬▬▬▬▬▬▬▬▬▬\n\`[Streaming]\` | Added by ${result.track.requester.mention}`,
                    color: 0xf39bff    
                }
            ]
        });
        return;
    }
    await ctx.send({
        embeds: [
            {
                description: `**[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})**\n${result.bar}\n\`[${result.currentProgress} / ${result.fullProgress}]\` | Added by ${result.track.requester.mention}`,
                color: 0xf39bff
            }
        ]
    });
    return;
}

function common(guildId, userId) {
    const { bot, msToTime, msToTimeString } = require("../../main.js");
    const { musicGuilds, getBar } = require("./util.js");
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
    if (musicGuilds[guildId].queue.length === 0) {
        return {
            errored: true,
            code: "There's nothing playing right now."
        };
    }
    if (musicGuilds[guildId].queue[0].info.isStream) {
        return {
            errored: false,
            code: "SUCCESS",
            track: musicGuilds[guildId].queue[0]
        };
    }
    let currentProgress = bot.voiceConnections.get(guildId).paused ? Math.min(bot.voiceConnections.get(guildId).state.position, musicGuilds[guildId].queue[0].info.length) : Math.min(bot.voiceConnections.get(guildId).state.position + (new Date().getTime() - bot.voiceConnections.get(guildId).state.time), musicGuilds[guildId].queue[0].info.length);
    let bar = getBar((currentProgress / musicGuilds[guildId].queue[0].info.length) * 100);
    let currentProgressTime = msToTime(currentProgress);
    // Edge case: there's instances of this being NaN / -1 at the start of a track, so we can fix it by setting it to 0:00
    if (isNaN(currentProgressTime["s"]) || currentProgressTime["s"] < 0) {
        currentProgressTime = { d: 0, h: 0, m: 0, s: 0 };
    }
    let currentProgressString = msToTimeString(currentProgressTime, true);
    let fullProgressTime = msToTime(musicGuilds[guildId].queue[0].info.length);
    let fullProgressString = msToTimeString(fullProgressTime, true);
    return {
        errored: false,
        code: "SUCCESS",
        track: musicGuilds[guildId].queue[0],
        bar: bar,
        currentProgress: currentProgressString,
        fullProgress: fullProgressString
    };
}