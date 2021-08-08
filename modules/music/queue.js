const { CommandOptionType } = require("slash-create");

module.exports.commands = ["queue", "q"];
module.exports.usage = "%cmd%";
module.exports.description = "Show what's going to be playing.";
module.exports.action = async function action (details) {
    if (!details["guild"]) {
        return "guild";
    }
    // Unlike slash, integer is NOT guaranteed
    let page = isNaN(parseInt(details["body"])) ? 1 : parseInt(details["body"]);
    let result = common(details["message"].channel.guild.id, details["message"].author.id, page);
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
            description: result.page,
            color: 0xf39bff,
            footer: {
                text: `Page ${result.currentPage} of ${result.totalPages}`
            }
        }
    });
    return true;
}

module.exports.slash = {
    name: "queue",
    description: module.exports.description,
    deferEphemeral: false,
    options: [
        {
            name: "page",
            description: "Page number to display.",
            type: CommandOptionType.INTEGER
        }
    ],
    guildOnly: true
}
module.exports.slashAction = async function slashAction(ctx) {
    let result = common(ctx.guildID, ctx.user.id, "page" in ctx.options ? parseInt(ctx.options["page"]) : 1);
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
                description: result.page,
                color: 0xf39bff,
                footer: {
                    text: `Page ${result.currentPage} of ${result.totalPages}`
                }
            }
        ]
    });
    return;
}

function common(guildId, userId, page) {
    const { bot, msToTime, msToTimeString } = require("../../main.js");
    const { musicGuilds, paginate } = require("./util.js");
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
    if (musicGuilds[guildId].queue.length === 1) {
        return {
            errored: true,
            code: "There's nothing coming up."
        };
    }
    let comingUp = musicGuilds[guildId].queue.slice();
    comingUp.shift();
    let pages = paginate(comingUp, 5);
    if (page < 1 || page > pages.length) {
        return {
            errored: true,
            code: "Page out of range."
        };
    }
    // Find the first human-readable index for that page
    let firstIndex = 5 * (page - 1) + 1;
    // Find the size of that page
    let pageSize = pages[page - 1].length;
    // Get the largest number in that page
    let largestIndexSize = (firstIndex + pageSize - 1).toString().length;
    return {
        errored: false,
        code: "SUCCESS",
        page: pages[page - 1].map((track, index) => {
            let durationTime = msToTime(track.info.length);
            let duration = track.info.isStream ? "∞" : msToTimeString(durationTime, true);
            return `\`${(firstIndex + index).toString().padStart(largestIndexSize, " ")}.\` **[${track.info.friendlyTitle === null ? track.info.title : track.info.friendlyTitle}](${track.info.uri})** \`[${duration}]\``;
        }).join("\n"),
        currentPage: page,
        totalPages: pages.length
    };
}