const {CommandOptionType} = require("slash-create");

module.exports.commands = ["info"];
module.exports.usage = "%cmd% [stats]";
module.exports.description = "Display information about Quaver.";
module.exports.action = function (details) {
    const settings = require("../../main.js").settings;
    const managers = settings.get("managers");
    let type = "";
    if (details["body"] === "stats") {
        if (!managers.includes(details["message"].author.id)) {
            return "manager";
        }
        else {
            type = "stats";
        }
    }
    if (!["stats", ""].includes(details["body"])) {
        return "usage";
    }
    let embed = common(type);
    details["message"].channel.createMessage({
        messageReference: {messageID: details["message"].id},
        embed: embed
    });
    return true;
};

module.exports.slash = {
    name: "info",
    description: "Display information about Quaver.",
    deferEphemeral: false,
    options: [
        {
            name: "stats",
            description: "Display additional statistics about Quaver.",
            required: false,
            type: CommandOptionType.BOOLEAN
        }
    ]
};
module.exports.slashAction = async function(ctx) {
    await ctx.defer();
    const settings = require("../../main.js").settings;
    const managers = settings.get("managers");
    let type = "";
    if ("stats" in ctx.options) {
        if (!managers.includes(ctx.user.id)) {
            await require("../../main.js").slashManagerRejection(ctx);
            return;
        }
        else {
            type = "stats";
        }
    }
    let embed = common(type);
    await ctx.send({
        embeds: [embed]
    });
}

function common(type) {
    const build = require("../../main.js").build;
    const version = require("../../main.js").version;
    const modules = require("../../main.js").modules;
    const bot = require("../../main.js").bot;
    const msToTime = require("../../main.js").msToTime;
    const msToTimeString = require("../../main.js").msToTimeString;
    const roundTo = require("../../main.js").roundTo;
    let userTotal = 0;
    bot.guilds.map(g => g.memberCount).forEach(a => userTotal += a);
    let channelTotal = 0;
    bot.guilds.map(g => g.channels.size).forEach(a => channelTotal += a);
    let uptime = msToTime(process.uptime() * 1000);
    let uptimeString = msToTimeString(uptime);
    let modulesLoaded = Object.keys(modules).length;
    let actionsLoaded = 0;
    Object.keys(modules).forEach(module => {
        actionsLoaded += Object.keys(modules[module]).length;
    });
    return {
        title: "Quaver",
        description: `A music bot, part of the ZapSquared Network.\nSource code available [here](https://github.com/zapteryx/Quaver).\nRunning version \`${version}\`.`,
        color: 0xf39bff,
        fields: type === "stats" ? [
            {
                name: "Bot Statistics",
                value: `**Servers**: ${bot.guilds.size}\n**Users**: ${userTotal} (${bot.users.size} cached)\n**Channels**: ${channelTotal}`
            },
            {
                name: "Technical Statistics",
                value: `**RAM Usage**: ${roundTo(process.memoryUsage().heapUsed / 1024 / 1024, 2).toString()} MB\n**Uptime**: ${uptimeString}\n**Modules Loaded**: ${modulesLoaded} (${actionsLoaded} actions)`
            },
            {
                name: "Version",
                value: `**Quaver**: \`${version}\` [\`${build.slice(0, 7)}\`](https://github.com/zapteryx/Quaver/commit/${build})\n**Eris**: \`${require("eris").VERSION}\`\n**NodeJS**: \`${process.env.NODE_VERSION}\``
            }
        ] : [],
        thumbnail: {
            url: bot.user.avatarURL
        }
    };
}