module.exports.commands = ["skip"];
module.exports.usage = "%cmd%";
module.exports.description = "Skip the current track.";
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
    if (result.code === "SUCCESS") {
        details["message"].channel.createMessage({
            messageReference: {messageID: details["message"].id},
            embed: {
                description: `Skipped **[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})**${result.cause !== null ? `by ${result.cause}` : ""}\nAdded by ${result.track.requester.mention}`,
                color: 0xf39bff
            }
        });
        return true;
    }
    details["message"].channel.createMessage({
        messageReference: {messageID: details["message"].id},
        embed: {
            description: `Voted to skip **[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})** (${result.votes}/${result.requiredVotes})`,
            color: 0xf39bff
        }
    });
}

module.exports.slash = {
    name: "skip",
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
    if (result.code === "SUCCESS") {
        await ctx.send({
            embeds: [
                {
                    description: `Skipped **[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})**${result.cause !== null ? `by ${result.cause}` : ""}\nAdded by ${result.track.requester.mention}`,
                    color: 0xf39bff
                }
            ]
        });
        return;
    }
    await ctx.send({
        embeds: [
            {
                description: `Voted to skip **[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})** (${result.votes}/${result.requiredVotes})`,
                color: 0xf39bff
            }
        ]
    });
}

async function common(guildId, userId) {
    const { bot, getPermsMatch } = require("../../main.js");
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
    if (musicGuilds[guildId].queue.length === 0) {
        return {
            errored: true,
            code: "There's nothing playing right now."
        };
    }
    let skip = false;
    let cause = null;
    let currentTrack = musicGuilds[guildId].queue[0];
    // This track was requested by the user
    if (musicGuilds[guildId].queue[0].requester.id === userId) {
        skip = true;
    }
    // The user has elevated permissions
    else if (getPermsMatch(bot.guilds.get(guildId).members.get(userId).permissions, ["manageGuild"]).length > 0) {
        skip = true;
        cause = "force";
    }
    // Start the voting process
    else {
        if (!("skip" in musicGuilds[guildId])) {
            let userCount = bot.guilds.get(guildId).channels.get(musicGuilds[guildId].voice.id).voiceMembers.filter(member => !member.bot).length;
            musicGuilds[guildId].skip = {
                required: Math.ceil(userCount / 2),
                users: []
            };
        }
        if (musicGuilds[guildId].skip.users.includes(userId)) {
            return {
                errored: true,
                code: "You've already voted to skip this track."
            };
        }
        musicGuilds[guildId].skip.users.push(userId);
        if (musicGuilds[guildId].skip.users.length >= musicGuilds[guildId].skip.required) {
            skip = true;
            cause = "voting";
        }
        if (!skip) {
            return {
                errored: false,
                code: "VOTED",
                track: musicGuilds[guildId].queue[0],
                votes: musicGuilds[guildId].skip.users.length,
                requiredVotes: musicGuilds[guildId].skip.required
            };
        }
        let player = await getPlayer(musicGuilds[guildId].voice);
        player.stop();
    }
    return {
        errored: false,
        code: "SUCCESS",
        track: currentTrack,
        cause: cause
    };
}