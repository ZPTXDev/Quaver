const { CommandOptionType } = require("slash-create");

module.exports.commands = ["lyrics", "ly"];
module.exports.usage = "%cmd% [song]";
module.exports.description = "Display the lyrics for a song.";
module.exports.action = async function action (details) {
    if (!details["guild"]) {
        return "guild";
    }
    let result = await common(details["message"].channel.guild.id, details["body"]);
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
            description: `**[${result.title}](${result.url})**`,
            fields: result.lyrics,
            color: 0xf39bff,
            footer: {
                text: "Lyrics provided by KSoft.Si"
            }
        }
    });
    return true;
}

module.exports.slash = {
    name: "lyrics",
    description: module.exports.description,
    deferEphemeral: false,
    options: [
        {
            name: "song",
            description: "The song to display lyrics for. If not specified, it will use what's currently playing instead.",
            type: CommandOptionType.STRING
        }
    ],
    guildOnly: true
}
module.exports.slashAction = async function slashAction(ctx) {
    let result = await common(ctx.guildID, "song" in ctx.options ? ctx.options["song"] : "");
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
                description: `**[${result.title}](${result.url})**`,
                fields: result.lyrics,
                color: 0xf39bff,
                footer: {
                    text: "Lyrics provided by KSoft.Si"
                }
            }
        ]
    });
    return;
}

async function common(guildId, search) {
    const { KSoftClient } = require('@ksoft/api');
    const { bot, settings } = require("../../main.js");
    const { musicGuilds } = require("./util.js");
    if (!settings.get("ksoftKey")) {
        return {
            errored: true,
            code: "This feature was not set up."
        };
    }
    const ksoft = new KSoftClient(settings.get("ksoftKey"));
    if (search === "" && (!(guildId in musicGuilds) || musicGuilds[guildId].queue.length === 0)) {
        return {
            errored: true,
            code: "There's nothing playing right now, and no search was provided."
        };
    }
    if (!search) {
        let currentTrack = musicGuilds[guildId].queue[0];
        search = currentTrack.info.friendlyTitle === null ? currentTrack.info.title : currentTrack.info.friendlyTitle;
    }
    let lyricResult = await ksoft.lyrics.get(search);
    let lyrics = lyricResult.lyrics;
    if (!lyrics) {lyrics = "There's nothing here.\n**[Let KSoft know.](https://discord.gg/7bqdQd4)**"}
    // This code is going to be EXTREMELY messy (ported from ZapSquared, adapted for Quaver)
    // If you can help simplify this, please make a PR, thanks!
    let lyricPages = [];
    let currentPage = [];
    // Create our own because \n counts as 1 char in String.prototype.length and Discord does not like that
    let currentLength = 0;
    lyrics.split("\n").forEach(line => {
        if (currentLength + line.length > 1024) {
            // Field name is a blank character to simulate a newline
            lyricPages.push({
                name: '​',
                value: currentPage.join("\n")
            });
            currentPage = [line];
            currentLength = line.length + 2;
            return;
        }
        currentPage.push(line);
        currentLength += line.length + 2;
    });
    lyricPages.push({
        name: '​',
        value: currentPage.join("\n")
    });
    let totalCharacters = 0;
    let maxedOutIndex = -1;
    for (const [index, page] of lyricPages.entries()) {
        totalCharacters += page.value.length;
        if (totalCharacters > 6000) {
            maxedOutIndex = index;
            break;
        }
    }
    if (maxedOutIndex !== -1) {
        lyricPages = lyricPages.slice(0, maxedOutIndex);
        cutoffText = `For the full lyrics, [click here](${lyricResult.url})`;
        lyricPages[lyricPages.length - 1].value = `${lyricPages[lyricPages.length - 1].value.slice(0, -3 - cutoffText.length)}...`;
        lyricPages.push({
            name: '​',
            value: cutoffText
        });
    }
    return {
        errored: false,
        code: "SUCCESS",
        title: `${lyricResult.artist ? `${lyricResult.artist.name} - ` : ""}${lyricResult.name}`,
        url: lyricResult.url,
        lyrics: lyricPages
    };
}