const { CommandOptionType } = require("slash-create");

module.exports.commands = ["volume", "vol"];
module.exports.usage = "%cmd% volume";
module.exports.description = "Change the volume of the bot.";
module.exports.action = async function action (details) {
    if (!details["guild"]) {
        return "guild";
    }
    if (!details["body"] || isNaN(parseInt(details["body"]))) {
        return "usage";
    }
    let volume = parseInt(details["body"]);
    let result = await common(details["message"].channel.guild.id, details["message"].author.id, volume);
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
            description: `Volume adjusted to **${volume}%**`,
            color: 0xf39bff
        }
    });
    return true;
}

module.exports.slash = {
    name: "volume",
    description: module.exports.description,
    deferEphemeral: false,
    options: [
        {
            name: "volume",
            description: "Volume to change to.",
            required: true,
            type: CommandOptionType.INTEGER
        }
    ],
    guildOnly: true
}
module.exports.slashAction = async function slashAction(ctx) {
    let result = await common(ctx.guildID, ctx.user.id, ctx.options["volume"]);
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
                description: `Volume adjusted to **${ctx.options["volume"]}%**`,
                color: 0xf39bff
            }
        ]
    });
    return;
}

async function common(guildId, userId, volume) {
    const { bot, settings } = require("../../main.js");
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
    let managers = settings.get("managers");
    if (volume < 0 || (volume > 200 && !managers.includes(userId))) {
        return {
            errored: true,
            code: "That is not within the valid range of **0%** - **200%**."
        };
    }
    let player = await getPlayer(musicGuilds[guildId].voice);
    player.setVolume(volume);
    musicGuilds[guildId].volume = volume;
    return {
        errored: false,
        code: "SUCCESS"
    };
}