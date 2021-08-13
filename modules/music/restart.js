module.exports.commands = ["restart"];
module.exports.usage = "%cmd%";
module.exports.description = "Restart the current track.";
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
    if (result.code === "SUCCESS") {
        details["message"].channel.createMessage({
            messageReference: {messageID: details["message"].id},
            embed: {
                description: `Restarted **[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})**${result.cause !== null ? ` by ${result.cause}\nAdded by ${result.track.requester.mention}` : ""}`,
                color: 0xf39bff
            }
        });
        return true;
    }
    details["message"].channel.createMessage({
        messageReference: {messageID: details["message"].id},
        embed: {
            description: `Voted to restart **[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})** (${result.votes}/${result.requiredVotes})`,
            color: 0xf39bff
        }
    });
}

module.exports.slash = {
    name: "restart",
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
    if (result.code === "SUCCESS") {
        await ctx.send({
            embeds: [
                {
                    description: `Restarted **[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})**${result.cause !== null ? ` by ${result.cause}\nAdded by ${result.track.requester.mention}` : ""}`,
                    color: 0xf39bff
                }
            ]
        });
        return;
    }
    await ctx.send({
        embeds: [
            {
                description: `Voted to restart **[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})** (${result.votes}/${result.requiredVotes})`,
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
    if (musicGuilds[guildId].queue[0].info.isStream) {
        return {
            errored: true,
            code: "Streams cannot be restarted."
        };
    }
    let restart = false;
    let cause = null;
    let currentTrack = musicGuilds[guildId].queue[0];
    // This track was requested by the user
    if (musicGuilds[guildId].queue[0].requester.id === userId) {
        restart = true;
    }
    // The user has elevated permissions
    else if (getPermsMatch(bot.guilds.get(guildId).members.get(userId).permissions, ["manageGuild"]).length === 0) {
        restart = true;
        cause = "force";
    }
    // Start the voting process
    else {
        if (!("restart" in musicGuilds[guildId])) {
            let userCount = bot.guilds.get(guildId).channels.get(musicGuilds[guildId].voice.id).voiceMembers.filter(member => !member.bot).length;
            musicGuilds[guildId].restart = {
                required: Math.ceil(userCount / 2),
                users: []
            };
        }
        if (musicGuilds[guildId].restart.users.includes(userId)) {
            return {
                errored: true,
                code: "You've already voted to restart this track."
            };
        }
        musicGuilds[guildId].restart.users.push(userId);
        if (musicGuilds[guildId].restart.users.length >= musicGuilds[guildId].restart.required) {
            restart = true;
            cause = "voting";
        }
        if (!restart) {
            return {
                errored: false,
                code: "VOTED",
                track: musicGuilds[guildId].queue[0],
                votes: musicGuilds[guildId].restart.users.length,
                requiredVotes: musicGuilds[guildId].restart.required
            };
        }
    }
    let player = await getPlayer(musicGuilds[guildId].voice);
    player.seek(0);
    bot.voiceConnections.get(guildId).timestamp = Date.now();
    delete musicGuilds[guildId].restart;
    return {
        errored: false,
        code: "SUCCESS",
        track: currentTrack,
        cause: cause
    };
}