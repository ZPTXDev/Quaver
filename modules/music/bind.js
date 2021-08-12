const { CommandOptionType } = require("slash-create");

module.exports.commands = ["bind"];
module.exports.usage = "%cmd% #channel";
module.exports.description = "Change the text channel to use for music messages.";
module.exports.action = async function action (details) {
    if (!details["guild"]) {
        return "guild";
    }
    if (details["message"].channelMentions.length < 1) {
        return "usage";
    }
    let channelId = details["message"].channelMentions[0];
    let result = common(details["message"].channel.guild.id, details["message"].author.id, channelId);
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
            description: `Successfully binded to <#${channelId}>`,
            color: 0xf39bff
        }
    });
    return true;
}

module.exports.slash = {
    name: "bind",
    description: module.exports.description,
    deferEphemeral: false,
    options: [
        {
            name: "channel",
            description: "Text channel to bind to.",
            required: true,
            type: CommandOptionType.CHANNEL
        }
    ],
    guildOnly: true
}
module.exports.slashAction = async function slashAction(ctx) {
    let result = common(ctx.guildID, ctx.user.id, ctx.options["channel"]);
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
                description: `Successfully binded to <#${ctx.options["channel"]}>`,
                color: 0xf39bff
            }
        ]
    });
    return;
}

function common(guildId, userId, channelId) {
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
    let channel = bot.guilds.get(guildId).channels.get(channelId);
    if (!channel || channel.type !== 0) {
        return {
            errored: true,
            code: "That is not a valid text channel."
        };
    }
    musicGuilds[guildId].channel = channel;
    return {
        errored: false,
        code: "SUCCESS"
    };
}