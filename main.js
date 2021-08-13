const { SlashCreator, GatewayServer, SlashCommand } = require("slash-create");
const Eris = require("eris");
const { PlayerManager } = require("eris-lavalink");
const settings = require("data-store")({path: "settings.json"});
const musicData = require("data-store")({path: "music.json"});
const mysql = require("mysql2");
const reload = require("require-reload")(require);
const fs = require("fs");
const _ = require("lodash");
let ready = false;
const gitFilePath = `.git/refs/heads/${settings.get("dev") ? "dev" : "master"}`;
const build = fs.existsSync(gitFilePath) ? fs.readFileSync(gitFilePath).toString().replace("\n", "") : "unknown";
const { version } = require('./package.json');
let botLogChannelId = "";
let pool;
let promisePool;
let modules = {};
let users = {};
let guilds = {};

let initialTime = new Date().getTime();

if (Object.keys(settings.get()).length === 0) {
    settings.set("token", "Paste token here");
    settings.set("applicationId", "Paste application ID here");
    settings.set("publicKey", "Paste public key here");
    settings.set("managers", ["Paste manager ID here"]);
    settings.set("prefix", "q!");
    settings.set("mentionAsPrefix", true);
    settings.set("botLogChannelId", "Paste channel ID here");
    settings.set("database", {
        host: "",
        user: "",
        password: "",
        database: "",
        waitForConnections: true,
        connectionLimit: 10
    });
    console.log("[!] 'settings.json' has been generated. Please insert your details accordingly and restart Quaver.");
    process.exit(1);
}

if (!settings.get("token") || typeof settings.get("token") !== "string" || settings.get("token") === "Paste token here") {
    settings.set("token", "Paste token here");
    console.log("[!] Unable to start Quaver: No bot token provided");
    process.exit(1);
}

if (!settings.get("applicationId") || typeof settings.get("applicationId") !== "string" || settings.get("applicationId") === "Paste application ID here") {
    settings.set("applicationId", "Paste application ID here");
    console.log("[!] Unable to start Quaver: No application ID provided");
    process.exit(1);
}

if (!settings.get("publicKey") || typeof settings.get("publicKey") !== "string" || settings.get("publicKey") === "Paste public key here") {
    settings.set("publicKey", "Paste public key here");
    console.log("[!] Unable to start Quaver: No public key provided");
    process.exit(1);
}

if (!settings.get("managers") || typeof settings.get("managers") !== "object" || settings.get("managers").length < 1 || settings.get("managers") === ["Paste manager ID here"]) {
    settings.set("managers", ["Paste manager ID here"]);
    console.log("[!] Unable to start Quaver: No manager ID provided");
    process.exit(1);
}

if (!settings.get("botLogChannelId") || typeof settings.get("botLogChannelId") !== "string" || settings.get("botLogChannelId") === "Paste channel ID here") {
    settings.set("botLogChannelId", "Paste channel ID here");
    console.log("[!] Invalid bot log channel ID provided, messages won't be sent");
}
else {
    botLogChannelId = settings.get("botLogChannelId");
}

if (!settings.get("database")) {
    settings.set("database", {
        host: "",
        user: "",
        password: "",
        database: "",
        waitForConnections: true,
        connectionLimit: 10
    });
    console.log("[!] Unable to start Quaver: No database provided");
    process.exit(1);
}
else {
    pool = mysql.createPool(settings.get("database"));
    promisePool = pool.promise();
    promisePool.query("SELECT 1")
        .then(() => {
            console.log("[✓] Successfully established connection to database");
        })
        .catch(err => {
            console.log("[!] Unable to start Quaver: Invalid database provided (detailed error below)");
            console.log(err);
            process.exit(1);
        });
}

if (!settings.get("lavalink")) {
    settings.set("lavalink", [{
        "host": "",
        "port": "",
        "region": "",
        "password": ""
    }]);
    console.log("[!] Unable to start Quaver: No LavaLink credentials provided");
    process.exit(1);
}

if (!settings.get("prefix")) {
    settings.set("prefix", "q!");
    console.log("[!] Defaulted Quaver's prefix to 'q!'");
}

if (!settings.get("mentionAsPrefix") || typeof settings.get("mentionAsPrefix") !== "boolean") {
    settings.set("mentionAsPrefix", true);
    console.log("[!] Enabled Mention As Prefix by default");
}

console.log("[^] Loading modules...");
try {
    let files = fs.readdirSync("modules", {withFileTypes: true});
    files.forEach((f, i) => {
        if (!f.isDirectory()) {
            console.log(`[!] Unable to start Quaver: Non-folder (${f.name}) in modules folder`);
            process.exit(1);
        }
        if (f.name.includes(" ")) {
            console.log(`[!] Unable to start Quaver: Module name contains space (${f.name})`);
            process.exit(1);
        }
        console.log(`[^] Loading module '${f.name}' (${i+1}/${files.length})`);
        modules[f.name] = {};
        try {
            let subfiles = fs.readdirSync(`modules/${f.name}`, {withFileTypes: true});
            if (subfiles.length === 0) {
                console.log(`[!] No actions found in '${f.name}'`);
            }
            else {
                subfiles.forEach((sf, idx) => {
                    if (!sf.isFile()) {
                        console.log(`[!] Unable to start Quaver: Non-file (${sf.name}) in '${f.name}' folder`);
                        process.exit(1);
                    }
                    let split = sf.name.split(".");
                    if (split[split.length - 1] !== "js") {
                        console.log(`[!] Unable to start Quaver: Non-JS file (${sf.name}) in '${f.name}' folder`);
                        process.exit(1);
                    }
                    if (sf.name.includes(" ")) {
                        console.log(`[!] Unable to start Quaver: Action name contains space (${sf.name.slice(0, -3)})`);
                        process.exit(1);
                    }
                    console.log(`[^] Loading action '${sf.name.slice(0, -3)}' (${idx+1}/${subfiles.length})`);
                    modules[f.name][sf.name.slice(0, -3)] = reload(`./modules/${f.name}/${sf.name}`);
                    console.log(`[✓] Loaded action '${sf.name.slice(0, -3)}' (${idx+1}/${subfiles.length})`);
                });
            }
            subfiles = null;
        }
        catch (err) {
            console.log(`[!] Unable to read module '${f.name}' (detailed error below)`);
            console.log(err);
        }
        console.log(`[✓] Loaded module '${f.name}' (${i+1}/${files.length})`);
    });
}
catch (err) {
    console.log("[!] Unable to start Quaver: Could not read modules folder (detailed error below)");
    console.log(err);
    process.exit(1);
}

const bot = new Eris(`Bot ${settings.get("token")}`);

const creator = new SlashCreator({
    applicationID: settings.get("applicationId"),
    publicKey: settings.get("publicKey"),
    token: settings.get("token"),
});
creator.on("commandRun", (cmd, res, ctx) => {
    console.log(`[S] ${!!ctx.guildID ? `${bot.guilds.get(ctx.guildID).name} (${ctx.guildID}) | ` : ""}${ctx.user.username}#${ctx.user.discriminator} (${ctx.user.id}): CMD ${ctx.commandName}, OPT ${JSON.stringify(ctx.options)}`);
});
creator.on("commandError", (cmd, err) => {
    console.log("[!] An error occurred with Slash Commands (commandError) (detailed error below)");
    console.log(err);
});
creator.on("error", err => {
    console.log("[!] An error occurred with Slash Commands (error) (detailed error below)");
    console.log(err);
});

// thanks: https://gist.github.com/flangofas/714f401b63a1c3d84aaa
function msToTime(milliseconds, format) {
    let days, hours, minutes, seconds, total_hours, total_minutes, total_seconds;

    total_seconds = parseInt(Math.floor(milliseconds / 1000));
    total_minutes = parseInt(Math.floor(total_seconds / 60));
    total_hours = parseInt(Math.floor(total_minutes / 60));
    days = parseInt(Math.floor(total_hours / 24));

    seconds = parseInt(total_seconds % 60);
    minutes = parseInt(total_minutes % 60);
    hours = parseInt(total_hours % 24);

    switch(format) {
        case 's':
            return total_seconds;
        case 'm':
            return total_minutes;
        case 'h':
            return total_hours;
        case 'd':
            return days;
        default:
            return { d: days, h: hours, m: minutes, s: seconds };
    }
}
function msToTimeString(msObject, simple) {
    if (simple) {
        if (msObject["d"] > 0) {
            return "more than a day";
        }
        return `${msObject["h"] > 0 ? `${msObject["h"]}:` : ""}${msObject["h"] > 0 ? msObject["m"].toString().padStart(2, "0") : msObject["m"]}:${msObject["s"].toString().padStart(2, "0")}`;
    }
    return `${msObject["d"] > 0 ? `${msObject["d"]} day${msObject["d"] === 1 ? "" : "s"}, ` : ""}${msObject["h"] > 0 ? `${msObject["h"]} hr${msObject["h"] === 1 ? "" : "s"}, ` : ""}${msObject["m"] > 0 ? `${msObject["m"]} min${msObject["m"] === 1 ? "" : "s"}, ` : ""}${msObject["s"] > 0 ? `${msObject["s"]} sec${msObject["s"] === 1 ? "" : "s"}, ` : ""}`.slice(0, -2);
}
// thanks: https://stackoverflow.com/a/15762794
function roundTo(n, digits) {
    let negative = false;
    if (digits === undefined) {digits = 0;}
    if (n < 0) {negative = true; n = n * -1;}
    let multiplicator = Math.pow(10, digits);
    n = parseFloat((n * multiplicator).toFixed(11));
    n = (Math.round(n) / multiplicator).toFixed(digits);
    if (negative) {n = (n * -1).toFixed(digits);}
    if (digits === 0) {n = parseInt(n, 10);}
    return n;
}
// thanks: https://stackoverflow.com/a/54897508
function getSeconds(str) {
    let seconds = 0;
    let days = str.match(/(\d+)\s*d/);
    let hours = str.match(/(\d+)\s*h/);
    let minutes = str.match(/(\d+)\s*m/);
    let secs = str.match(/(\d+)\s*s/);
    if (days) { seconds += parseInt(days[1])*86400; }
    if (hours) { seconds += parseInt(hours[1])*3600; }
    if (minutes) { seconds += parseInt(minutes[1])*60; }
    if (secs) { seconds += parseInt(secs[1]); }
    return seconds;
}
function getUserId(cont, types=null, guildId) {
    if (types === null) {
        types = ["mention", "id", "nickname", "username"];
    }
    let userId;
    if (types.includes("mention") && cont.startsWith("<@") && cont.endsWith(">")) {
        userId = cont.replace(/<@!?/, "").replace(/>/, "");
        if (!bot.users.get(userId)) {
            userId = "";
        }
    }
    if (!userId && types.includes("id")) {
        userId = cont;
        if (!bot.users.get(userId)) {
            userId = "";
        }
    }
    if (!userId && types.includes("nickname") && guildId) {
        let guildMember = bot.guilds.get(guildId).members.find(u => u.nick && u.nick.toLowerCase() === cont.toLowerCase());
        if (guildMember) {
            userId = guildMember.id;
        }
    }
    if (!userId && types.includes("username") && guildId) {
        if (cont.includes("#")) {
            let split = cont.split("#");
            let guildMember = bot.guilds.get(guildId).members.find(u => `${u.username}#${u.discriminator}` === `${split[0]}#${split[1]}`);
            if (guildMember) {
                userId = guildMember.id;
            }
        }
        else {
            let guildMember = bot.guilds.get(guildId).members.find(u => u.username.toLowerCase() === cont.toLowerCase());
            if (guildMember) {
                userId = guildMember.id;
            }
        }
    }
    if (!userId) {
        userId = "";
    }
    return userId;
}
function getPermsMatch(userPerms, perms) {
    let permsMissing = [];
    perms.forEach(p => {
        if (!userPerms.has(p)) {
            permsMissing.push(p);
        }
    });
    return permsMissing;
}
async function databaseSync() {
    let u = await promisePool.query("SELECT * FROM `users`");
    let g = await promisePool.query("SELECT * FROM `guilds`");
    u[0].forEach(res => {
        users[res["userid"]] = res;
    });
    g[0].forEach(res => {
        guilds[res["guildid"]] = res;
    });
}
async function slashManagerRejection(ctx) {
    return ctx.send({
        embeds: [
            {
                description: "You need to be a **Manager** to use that.",
                color: 0xf39bff
            }
        ],
        ephemeral: true
    });
}
async function slashPermissionRejection(ctx, permsArray) {
    let target = permsArray.shift();
    return ctx.send({
        embeds: [
            {
                description: `${target === "self" ? "I am" : "You are"} missing permission${permsArray.length !== 1 ? "s" : ""}: ${permsArray.map(r => `**${_.startCase(r)}**`).join(", ")}`,
                color: 0xf39bff
            }
        ],
        ephemeral: true
    });
}

exports.settings = settings;
exports.musicData = musicData;
exports.reload = reload;
exports.build = build;
exports.version = version;
exports.promisePool = promisePool;
exports.modules = modules;
exports.bot = bot;
exports.msToTime = msToTime;
exports.msToTimeString = msToTimeString;
exports.roundTo = roundTo;
exports.getUserId = getUserId;
exports.getPermsMatch = getPermsMatch;
exports.getSeconds = getSeconds;
exports.databaseSync = databaseSync;
exports.slashManagerRejection = slashManagerRejection;
exports.slashPermissionRejection = slashPermissionRejection;

bot.on("ready", () => {
    const { musicGuilds, getPlayer, play } = require("./modules/music/util.js");
    if (!ready) {
        const nodes = settings.get("lavalink");
        if (!(bot.voiceConnections instanceof PlayerManager)) {
            bot.voiceConnections = new PlayerManager(bot, nodes, {
                numShards: bot.shards.size, // number of shards
                userId: bot.user.id // the user id of the bot
            });
        }
        // There's some sessions from when we stopped the bot
        if (Object.keys(musicData.get()).length > 0) {
            for (const guildId of Object.keys(musicData.get())) {
                let guildData = musicData.get(guildId);
                musicGuilds[guildId] = guildData;
                musicData.del(guildId);
            }
        }
        let timeTaken = (Date.now() - initialTime) / 1000;
        let startupLogs = [];
        startupLogs.push(`[✓] Quaver started successfully (took ${timeTaken}s)`);
        startupLogs.push(`[>] Running build: ${build}`);
        if (settings.get("lastBuild") !== build) {
            if (settings.get("lastBuild")) {
                startupLogs.push(`[>] Previous build: ${settings.get("lastBuild")}`);
            }
            settings.set("lastBuild", build);
        }
        startupLogs.push(`[>] Build version: ${version}`);
        startupLogs.push(`[>] Loaded modules: ${Object.keys(modules).length > 0 ? Object.keys(modules).map(moduleName => `${moduleName} (${Object.keys(modules[moduleName]).length})`).join(", ") : "None"}`);
        startupLogs.push(`[>] Logged in to Discord as ${bot.user.username}#${bot.user.discriminator} (${bot.user.id})`);
        startupLogs.push(`[>] Connected to ${bot.guilds.size} guild${bot.guilds.size === 1 ? "" : "s"}`);
        startupLogs.push(`[>] Invite link: https://discord.com/oauth2/authorize?client_id=${bot.user.id}&scope=bot&permissions=8`);
        console.log(startupLogs.join("\n"));
        if (botLogChannelId !== "") {
            bot.createMessage(botLogChannelId, {
                embed: {
                    description: "```" + startupLogs.join("\n") + "```",
                    color: 0xf39bff
                }
            }).catch(() => {
                botLogChannelId = "";
                console.log("[!] Invalid bot log channel ID provided, messages won't be sent");
            });
        }
        initialTime = null;
        timeTaken = null;
        ready = true;
        bot.options.defaultImageFormat = "png";
        bot.editStatus("idle", {name: "the best music", type: 2});

        let slashCommands = [];
        Object.keys(modules).forEach(module => {
            Object.keys(modules[module]).forEach(action => {
                if ("slash" in modules[module][action]) {
                    let slash = class Command extends SlashCommand {
                        constructor(creator) {
                            if (modules[module][action]["slash"].guildOnly) {
                                delete modules[module][action]["slash"].guildOnly;
                                modules[module][action]["slash"].guildIDs = bot.guilds.map(g => g.id);
                            }
                            super(creator, modules[module][action]["slash"]);
                        }
                    }
                    slash.prototype.run = modules[module][action]["slashAction"];
                    slashCommands.push(slash);
                    slash = null;
                }
            });
        });

        creator
            .withServer(new GatewayServer(handler => {
                bot.on("rawWS", event => {
                    if (event.t === "INTERACTION_CREATE") {
                        handler(event.d);
                    }
                });
            }))
            .registerCommands(slashCommands)
            .syncCommands();
    }
    // We've lost connection to Discord, so we're going to resume the players to prevent an abrupt disconnect.
    Object.keys(musicGuilds).forEach(async guildId => {
        if (musicGuilds[guildId].queue.length !== 0) {
            // This figures out the current position of the player, although not always very accurately.
            let currentPosition;
            let restarted = false;
            if (musicGuilds[guildId].currentPosition) {
                currentPosition = musicGuilds[guildId].currentPosition;
                restarted = true;
                delete musicGuilds[guildId].currentPosition;
            }
            else {
                currentPosition = bot.voiceConnections.get(guildId).paused ? Math.min(bot.voiceConnections.get(guildId).state.position, musicGuilds[guildId].queue[0].info.length) : Math.min(bot.voiceConnections.get(guildId).state.position + (Date.now() - bot.voiceConnections.get(guildId).state.time), musicGuilds[guildId].queue[0].info.length);
            }
            // For the case that we've just restarted the bot, play it safe by getting the voice channel again
            let voice;
            let player;
            if (restarted) {
                let channel = bot.guilds.get(guildId).channels.get(musicGuilds[guildId].channel.id);
                voice = bot.guilds.get(guildId).channels.get(musicGuilds[guildId].voice.id);
                // Give it a second when restarting the bot, before we're able to get the player.
                await new Promise(resolve => setTimeout(resolve, 1000));
                player = await bot.joinVoiceChannel(musicGuilds[guildId].voice.id);
                musicGuilds[guildId].voice = voice;
                musicGuilds[guildId].channel = channel;
                await musicGuilds[guildId].channel.createMessage({
                    embed: {
                        description: "Resuming your session.",
                        color: 0xf39bff
                    }
                });
                // If it's a restart, we'll need to re-define the event hooks
                // TODO: This can definitely be optimized by re-using the functions in util.js, but for now this will work
                player.on("disconnect", err => {
                    if (err) {console.log(err);}
                    delete musicGuilds[guildId];
                });
                player.on("error", async err => {
                    console.log("Error encountered for tracks:");
                    console.log(err);
                    let additionalInfo = "There's no case for what happened, which means something really bad probably happened. Use my disconnect command to reset the session.";
                    if (!musicGuilds[guildId].errored) {
                        additionalInfo = "Trying again.";
                        let player = await getPlayer(musicGuilds[guildId].voice);
                        player.play(musicGuilds[guildId].queue[0].track);
                        musicGuilds[guildId].errored = true;
                    }
                    else if (musicGuilds[guildId].errored) {
                        additionalInfo = "Skipping the track.";
                        let original = musicGuilds[guildId].queue;
                        const shifted = original.shift();
                        musicGuilds[guildId].queue = original;
                        delete musicGuilds[guildId].skip;
                        delete musicGuilds[guildId].errored;
                        if (original.length === 0) {next = null;}
                        else {next = original[0].track;}
                        await play(guild, next, false, false);
                    }
                    await musicGuilds[guildId].channel.createMessage({
                        embed: {
                            description: `An error occurred while playing the track.\n${additionalInfo}`,
                            color: 0xf39bff
                        }
                    });
                });
                player.on("end", async d => {
                    if (d.reason && d.reason === 'REPLACED') {return;}
                    let totalDuration = 0;
                    musicGuilds[guildId].queue.forEach(track => {
                        if (track.info) {
                            totalDuration += track.info.length;
                        }
                    });
                    let original = musicGuilds[guildId].queue;
                    const shifted = original.shift();
                    // Loop logic
                    if (musicGuilds[guildId].loop && shifted) {
                        // Preventing loop if track / queue duration is too short, because this causes ratelimits really quickly
                        if ((original.length === 0 && shifted.info.length < 60000) || totalDuration < 60000) {
                            await musicGuilds[guildId].channel.createMessage({
                                embed: {
                                    description: `Failed to loop **[${shifted.info.title}](${shifted.info.uri})** as the ${totalDuration < 60000 ? "queue" : "track"} duration is too short.`,
                                    color: 0xf39bff
                                }
                            });
                        }
                        else {
                            original.push(shifted);
                        }
                    }
                    musicGuilds[guildId].queue = original;
                    delete musicGuilds[guildId].skip;
                    delete musicGuilds[guildId].errored;
                    if (original.length === 0) {next = null;}
                    else {next = original[0].track;}
                    await play(bot.guilds.get(guildId), next, false, false);
                });
            }
            else {
                voice = musicGuilds[guildId].voice;
                player = await getPlayer(voice);
            }
            // If it's a stream, what's the point of resuming?
            // Simply play it again.
            if (musicGuilds[guildId].queue[0].info.isStream) {
                player.play(musicGuilds[guildId].queue[0].track);
            }
            // Else, we'll play it again and specify the start time as the last known position.
            else {
                player.play(musicGuilds[guildId].queue[0].track, {startTime: currentPosition});
            }
            // Update the internal timestamp to match when we played the track.
            bot.voiceConnections.get(guildId).timestamp -= currentPosition;
            // Re-send volume and equalizer settings
            player.setVolume(musicGuilds[guildId].volume);
            let eqValues = [
                {"band": 0, "gain": 0},
                {"band": 1, "gain": 0},
                {"band": 2, "gain": 0},
                {"band": 3, "gain": 0},
                {"band": 4, "gain": 0},
                {"band": 5, "gain": 0}
            ];
            if (musicGuilds[guildId].boost) {
                eqValues = [
                    {"band": 0, "gain": 1},
                    {"band": 1, "gain": 0.8},
                    {"band": 2, "gain": 0.6}
                ];
            }
            await player.sendEvent({op: 'equalizer', guildId: this.guildId, bands: eqValues});
        }
    });
});

bot.on("connect", id => {
    console.log(`[^] Shard ${id} connecting...`);
});

bot.on("error", (err, id) => {
    console.log(`[^] Shard ${id} encountered an error (detailed error below)`);
    console.log(err);
});

bot.on("shardDisconnect", (err, id) => {
    console.log(`[^] Shard ${id} disconnected${err ? " (detailed error below)" : ""}`);
    if (err) {
        console.log(err);
    }
});

bot.on("shardPreReady", id => {
    console.log(`[^] Shard ${id} pre-ready`);
});

bot.on("shardReady", id => {
    console.log(`[✓] Shard ${id} ready`);
});

bot.on("shardResume", id => {
    console.log(`[✓] Shard ${id} resumed`);
});

bot.on("messageCreate", async msg => {
    let prefix;
    let mention = false;
    let guild = "guild" in msg.channel;
    if (guild && msg.channel.guild.id in guilds) {
        prefix = guilds[msg.channel.guild.id].prefix;
    }
    else {
        prefix = settings.get("prefix");
    }
    if (settings.get("mentionAsPrefix") && msg.mentions.length > 0 && msg.mentions[0].id === bot.user.id) {
        let firstContent = msg.content.split(" ")[0];
        if ([`<@${bot.user.id}>`, `<@!${bot.user.id}>`].includes(firstContent)) {
            prefix = `${firstContent} `;
            mention = true;
        }
    }
    if (msg.content.startsWith(prefix)) {
        let content = msg.content.replace(prefix, "");
        if (mention) {
            let count = (content.match(/<@!?(\d+)>/g) || []).length;
            if (count === 0)  {
                msg.mentions.splice(0, 1);
            }
        }
        let cmd = content.split(" ")[0].toLowerCase();
        let body = content.split(" ").slice(1).join(" ");
        if (cmd) {
            for (const module of Object.keys(modules)) {
                for (const action of Object.keys(modules[module])) {
                    if ("commands" in modules[module][action] && modules[module][action]["commands"].includes(cmd) && "action" in modules[module][action] && typeof modules[module][action]["action"] === "function") {
                        let actionFunction = modules[module][action]["action"];
                        let result = await actionFunction({prefix: prefix, cmd: cmd, body: body, guild: guild, message: msg, slash: false});
                        console.log(`[C] ${guild ? `${msg.channel.guild.name} (${msg.channel.guild.id}) | ` : ""}${msg.author.username}#${msg.author.discriminator} (${msg.author.id}): ${msg.content}`);
                        switch (result) {
                            case "usage":
                                let resultMessage;
                                if ("usage" in modules[module][action]) {
                                    let usage = modules[module][action]["usage"].replace(/%cmd%/g, cmd).replace(/%mention%/g, msg.author.mention);
                                    resultMessage = `Usage: ${prefix}${usage}`;
                                }
                                else {
                                    resultMessage = "Command execution failed with no reason specified.";
                                }
                                await msg.channel.createMessage({
                                    messageReference: {messageID: msg.id},
                                    embed: {
                                        description: resultMessage,
                                        color: 0xf39bff
                                    }
                                });
                                break;
                            case "manager":
                                await msg.channel.createMessage({
                                    messageReference: {messageID: msg.id},
                                    embed: {
                                        description: "You need to be a **Manager** to use that.",
                                        color: 0xf39bff
                                    }
                                });
                                break;
                            case "guild":
                                await msg.channel.createMessage({
                                    messageReference: {messageID: msg.id},
                                    embed: {
                                        description: "You need to be in a server to use that.",
                                        color: 0xf39bff
                                    }
                                });
                                break;
                            case "user":
                                await msg.channel.createMessage({
                                    messageReference: {messageID: msg.id},
                                    embed: {
                                        description: "You need to be in Direct Messages to use that.",
                                        color: 0xf39bff
                                    }
                                });
                                break;
                            default:
                                if (Array.isArray(result)) {
                                    let target = result.shift();
                                    await msg.channel.createMessage({
                                        messageReference: {messageID: msg.id},
                                        embed: {
                                            description: `${target === "self" ? "I am" : "You are"} missing permission${result.length !== 1 ? "s" : ""}: ${result.map(r => `**${_.startCase(r)}**`).join(", ")}`,
                                            color: 0xf39bff
                                        }
                                    });
                                }
                                break;
                        }
                    }
                }
            }
        }
    }
    else if (msg.content === prefix.trim() && mention) {
        await msg.channel.createMessage({
            messageReference: {messageID: msg.id},
            embed: {
                description: `The prefix in this server is \`${guild && msg.channel.guild.id in guilds ? guilds[msg.channel.guild.id].prefix : settings.get("prefix")}\`.\nYou may also mention me, following it with a command.`,
                color: 0xf39bff
            }
        });
    }
});

bot.connect();