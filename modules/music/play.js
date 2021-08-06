const { CommandOptionType } = require("slash-create");

module.exports.commands = ["play", "p"];
module.exports.usage = "%cmd% query";
module.exports.description = "Play a track. Use ytsearch: for YouTube, scsearch: for SoundCloud, or a direct link.";
module.exports.action = async function action (details) {
    const { bot, getPermsMatch, msToTime, msToTimeString } = require("../../main.js");
    const { musicGuilds } = require("./util.js");
    if (details["body"] === "") {
        return "usage";
    }
    if (!details["message"].member.voiceState.channelID) {
        details["message"].channel.createMessage({
            messageReference: {messageID: details["message"].id},
            embed: {
                description: "You are not in a voice channel.",
                color: 0xf39bff
            }
        });
        return true;
    }
    let botPermsMissing = getPermsMatch(details["message"].channel.guild.members.get(bot.user.id).permissions, ["voiceConnect", "voiceSpeak"]);
    if (botPermsMissing.length > 0) {
        return ["self"].concat(botPermsMissing);
    }
    if (musicGuilds[details["guild"].id] && details["message"].member.voiceState.channelID != musicGuilds[details["guild"].id].voice.id) {
        details["message"].channel.createMessage({
            messageReference: {messageID: details["message"].id},
            embed: {
                description: "You are not in my voice channel.",
                color: 0xf39bff
            }
        });
        return true;
    }
    let result = await common(details["body"], details["message"].channel.guild.id, details["message"].author.id, details["message"].channel.id);
    if (result.errored) {
        details["message"].channel.createMessage({
            messageReference: {messageID: details["message"].id},
            embed: {
                description: result.error,
                color: 0xf39bff
            }
        });
        return true;
    }
    let durationTime = msToTime(result.track.info.length);
    let duration = msToTimeString(durationTime, true);
    if (!result.queued) {
        details["message"].channel.createMessage({
            embed: {
                description: `Now playing **[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})** \`[${duration}]\`\nAdded by ${result.track.requester.mention}`,
                color: 0xf39bff
            }
        });
        return true;
    }
    if (result.queued) {
        details["message"].channel.createMessage({
            embed: {
                description: `Added **[${result.track.info.friendlyTitle === null ? result.track.info.title : result.track.info.friendlyTitle}](${result.track.info.uri})** \`[${duration}]\` to queue\nAdded by ${result.track.requester.mention}`,
                color: 0xf39bff
            }
        });
        return true;
    }
}

module.exports.slash = {
    name: "play",
    description: module.exports.description,
    deferEphemeral: false,
    options: [
        {
            name: "query",
            description: "Query to search.",
            required: true,
            type: CommandOptionType.STRING
        }
    ],
    guildOnly: true
}
module.exports.slashAction = async function slashAction(ctx) {
    await ctx.defer();
    const { bot, slashPermissionRejection, getPermsMatch } = require("../../main.js");
    if (!bot.guilds.get(ctx.guildID).members.get(ctx.user.id).voiceState.channelID) {
        await ctx.send({
            embeds: [
                {
                    description: "You are not in a voice channel.",
                    color: 0xf39bff
                }
            ],
            ephemeral: true
        });
        return;
    }
    let botPermsMissing = getPermsMatch(bot.guilds.get(ctx.guildID).members.get(bot.user.id).permissions, ["voiceConnect", "voiceSpeak"]);
    if (botPermsMissing.length > 0) {
        await slashPermissionRejection(ctx, ["self"].concat(botPermsMissing));
        return;
    }
    if (musicGuilds[ctx.guildID] && bot.guilds.get(ctx.guildID).members.get(ctx.user.id).voiceState.channelID != musicGuilds[ctx.guildID].voice.id) {
        await ctx.send({
            embeds: [
                {
                    description: "You are not in my voice channel.",
                    color: 0xf39bff
                }
            ],
            ephemeral: true
        });
        return;
    }
    let result = await common(ctx.options["query"], ctx.guildId, ctx.user.id, ctx.channelID);
    if (result.errored) {
        await ctx.send({
            embeds: [
                {
                    description: result.error,
                    color: 0xf39bff
                }
            ],
            ephemeral: true
        });
    }
}

async function common(query, guildId, userId, channelId) {
    const { settings, bot } = require("../../main.js");
    // NOTE: while multiple nodes ARE allowed to be specified, only the FIRST one will be used
    const nodes = settings.get("lavalink");
    const { musicGuilds, querySorter, resolveTracks, trackHandler, queueHandler } = require("./util.js");
    if (querySorter(query).type === "id") {
        try {
            let result = await superagent.get("http://img.youtube.com/vi/" + query + "/mqdefault.jpg");
            if (result.status !== 200) {
                query = `ytsearch:${query}`;
            }
        }
        catch (err) {
            query = `ytsearch:${query}`;
        }
    }
    let sortedQuery = querySorter(query);
    let data = "";
    switch (sortedQuery.type) {
        case "id":
            // YouTube ID (11 char identifier)
            data = sortedQuery.id;
            break;
        case "url":
            // URL
            data = sortedQuery.url;
            break;
        case "spuri":
            // Spotify URI
            data = sortedQuery.spuri;
            break;
        case "scsearch":
            // SoundCloud Search (scsearch:) (explicitly declared)
            data = sortedQuery.search;
            break;
        case "ytsearch":
        case "default":
            // YouTube Search (ytsearch:) (explicitly declared OR none declared)
            data = sortedQuery.search;
            break;
    }
    let tracks = await resolveTracks(nodes[0], data);
    let track = trackHandler(tracks, sortedQuery.type, false);
    if (typeof track !== "object") {
        let error = `Received non-success error: \`${track}\``
        switch (track) {
            case "LOAD_FAILED":
                error = "Something went wrong while loading results for that track."
                break;
            case "UNKNOWN":
                error = "Something weird happened with the results for that track."
                break;
            case "NO_MATCHES":
                error = "No matches found for that query."
                break;
        }
        return {
            errored: true,
            error: error
        };
    }
    let guild = bot.guilds.get(guildId);
    let user = bot.guilds.get(guildId).members.get(userId).user;
    let channel = bot.guilds.get(guildId).channels.get(channelId);
    let voice = bot.guilds.get(guildId).members.get(userId).voiceState.channelID;
    let queued = await queueHandler(track, guild, user, channel, voice);
    return {
        errored: false,
        code: queued.code,
        track: queued.track,
        queued: queued.queued
    };
}