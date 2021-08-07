const superagent = require('superagent');
const getArtistTitle = require('get-artist-title');

const musicGuilds = {};

function querySorter(query) {
    type = "";
    id = "";
    url = "";
    spuri = "";
    search = "";
    origsearch = "";
    if (query.match(/[a-zA-Z0-9_-]{11}/) && query.length == 11) {
        id = query.match(/[a-zA-Z0-9_-]{11}/);
        type = "id";
    }
    else if (query.match(/^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/g)) {
        url = query.match(/^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/g);
        type = "url";
    }
    else {
        query.split(" ").forEach(b => {
            if (!type) {
                if (b.startsWith("spuri:")) {
                    spuri = b.split("spuri:")[1];
                    type = "spuri";
                }
                else if (b.startsWith("spotify:")) {
                    spuri = b;
                    type = "spuri";
                }
                else if (b.startsWith("ytsearch:")) {
                    search = "ytsearch:" + encodeURIComponent(query.split("ytsearch:")[1]);
                    origsearch = query.split("ytsearch:")[1];
                    type = "ytsearch";
                }
                else if (b.startsWith("scsearch:")) {
                    search = "scsearch:" + encodeURIComponent(query.split("scsearch:")[1]);
                    origsearch = query.split("scsearch:")[1];
                    type = "scsearch";
                }
                else {
                    search = "ytsearch:" + encodeURIComponent(query);
                    origsearch = query;
                    type = "default";
                }
            }
        });
    }
    return {type: type, id: id, url: url, spuri: spuri, search: search, origsearch: origsearch};
}

async function resolveTracks(node, search) {
    try {
        var result = await superagent.get(`http://${node.host}:${node.port}/loadtracks?identifier=${search}`)
            .set('Authorization', node.password)
            .set('Accept', 'application/json');
    }
    catch (err) {
        throw err;
    }
    if (!result) {
        throw "Unable to play that track.";
    }
    return result.body;
}

function getPlayer(channel) {
    const { bot } = require("../../main.js");
    if (!channel || !channel.guild) {
        return Promise.reject('Not a guild channel.');
    }
    let player = bot.voiceConnections.get(channel.guild.id);
    if (player) {
        return Promise.resolve(player);
    }
    return bot.joinVoiceChannel(channel.id);
}

function trackHandler(tracks, type, search) {
    if (["LOAD_FAILED", "UNKNOWN", "NO_MATCHES"].includes(tracks.loadType) || tracks.tracks.length == 0) {
        return tracks.loadType;
    }
    else if (tracks.loadType === "TRACK_LOADED" && ["id", "url"].includes(type)) {
        return tracks.tracks[0];
    }
    else if (tracks.loadType === "SEARCH_RESULT" && ["default", "ytsearch", "scsearch"].includes(type)) {
        if (!search) {return tracks.tracks[0];}
        else {return tracks.tracks;}
    }
    else if (tracks.loadType === "PLAYLIST_LOADED" && type == "url") {
        return;
    }
    else {
        return "UNKNOWN";
    }
}

async function queueHandler(track, guild, user, channel, voice) {
    track.requester = {
        username: user.username,
        discriminator: user.discriminator,
        id: user.id,
        avatarURL: user.avatarURL,
        mention: user.mention
    };
    track.info.title = track.info.title.length === 0 ? "*Missing title*" : track.info.title;
    track.info.author = track.info.author.length === 0 ? "*Missing author*" : track.info.author;
    let newQueue = false;
    let resQueue = false;
    if (!musicGuilds[guild.id] || !musicGuilds[guild.id].queue) {
        musicGuilds[guild.id] = {
            queue: [],
            channel: channel,
            voice: guild.channels.get(voice),
            guild: guild,
            boost: false,
            volume: 100,
            loop: false
        };
        newQueue = true;
    }
    if (!newQueue && musicGuilds[guild.id].queue.length === 0) {
        resQueue = true;
    }
    // Queue exists
    if (typeof musicGuilds[guild.id].queue !== "object") {
        return {code: "The queue is in a broken state."};
    }
    let identifiers = musicGuilds[guild.id].queue.map(q => q.info.identifier);
    if (identifiers.includes(track.info.identifier)) {
        return {code: "This track is already in the queue, or currently playing."};
    }
    // There's nothing in there right now
    if (musicGuilds[guild.id].queue.length === 0) {
        // Play it
        play(guild, track.track, newQueue, resQueue);
    }
    let defaultArtist = track.info.author;
    let defaultTitle = "???";
    let details = getArtistTitle(track.info.title, {defaultArtist: defaultArtist, defaultTitle: defaultTitle});
    track.info.friendlyTitle = details[1] !== defaultTitle ? `${details[0]} - ${details[1]}` : null;
    musicGuilds[guild.id].queue.push(track);
    return {code: "SUCCESS", track: track, newQueue: newQueue, restartQueue: resQueue};
}

async function play(guild, track, newQueue, resQueue) {
    const { msToTime, msToTimeString, bot } = require("../../main.js");
    // If no track is found (auto-called after a track ends), set a timeout to auto-disconnect after 30 minutes
    if (!track) {
        if (!(guild.id in musicGuilds)) {
            return;
        }
        musicGuilds[guild.id].channel.createMessage({
            embed: {
                description: `There's nothing left in the queue. I'll leave <t:${Math.floor(Date.now()/1000) + 1800}:R>.`,
                color: 0xf39bff
            }
        });
        musicGuilds[guild.id].timeout = setTimeout(guildId => {
            let channel = musicGuilds[guildId].channel;
            let voiceId = musicGuilds[guildId].voice.id;
            delete musicGuilds[guildId];
            bot.leaveVoiceChannel(voiceId);
            channel.createMessage({
                embed: {
                    description: "Disconnected from inactivity.",
                    color: 0xf39bff
                }
            });
        }, 1800000, guild.id);
        return;
    }
    // If the playing track is "dc" (requesting a disconnect)
    if (track === "dc") {
        let channel = musicGuilds[guild.id].channel;
        let voiceId = musicGuilds[guild.id].voice.id;
        delete musicGuilds[guild.id];
        bot.leaveVoiceChannel(voiceId);
        channel.createMessage({
            embed: {
                description: "Disconnected by request.",
                color: 0xf39bff
            }
        });
        return;
    }
    // Cancel timeout if there's any set, we're going to be playing something
    if ("timeout" in musicGuilds[guild.id]) {
        clearTimeout(musicGuilds[guild.id].timeout);
        delete musicGuilds[guild.id].timeout;
    }
    let player = await getPlayer(musicGuilds[guild.id].voice);
    if (newQueue) {
        // Deafen self, because that's cool and quirky (this is purely visual, and doesn't actually stop audio from being received)
        bot.voiceConnections.get(guild.id).updateVoiceState(musicGuilds[guild.id].voice.id, false, true);
    }
    // If there's no one here, excluding bots, we should make a move
    if (bot.guilds.get(guild.id).channels.get(musicGuilds[guild.id].voice.id).voiceMembers.filter(m => !m.bot).length < 1) {
        let voice = musicGuilds[guild.id].voice;
        let channel = musicGuilds[guild.id].channel;
        delete musicGuilds[guild.id];
        bot.leaveVoiceChannel(voice.id);
        channel.createMessage({
            embed: {
                description: "Disconnected as everyone left.",
                color: 0xf39bff
            }
        });
        return;
    }
    player.play(track);
    if (!newQueue && !resQueue) {
        let currentTrack = musicGuilds[guild.id].queue[0];
        let durationTime = msToTime(currentTrack.info.length);
        let duration = currentTrack.info.isStream ? "∞" : msToTimeString(durationTime, true);
        musicGuilds[guild.id].channel.createMessage({
            embed: {
                description: `Now playing **[${currentTrack.info.friendlyTitle === null ? currentTrack.info.title : currentTrack.info.friendlyTitle}](${currentTrack.info.uri})** \`[${duration}]\`\nAdded by ${currentTrack.requester.mention}`,
                color: 0xf39bff
            }
        });
        return;
    }
    // Event hooks already defined, don't re-define them
    if (resQueue) {return;}
    player.on("disconnect", err => {
        if (err) {console.log(err);}
        delete musicGuilds[guild.id];
    });
    player.on("error", async err => {
        console.log("Error encountered for tracks:");
        console.log(err);
        let additionalInfo = "There's no case for what happened, which means something really bad probably happened. Use my disconnect command to reset the session.";
        let title = musicGuilds[guild.id].queue[0].info.friendlyTitle === null ? musicGuilds[guild.id].queue[0].info.title : musicGuilds[guild.id].queue[0].info.friendlyTitle;
        let uri = musicGuilds[guild.id].queue[0].info.uri;
        if (!musicGuilds[guild.id].errored) {
            additionalInfo = "Trying again.";
            let player = await getPlayer(musicGuilds[guild.id].voice);
            player.play(musicGuilds[guild.id].queue[0].track);
            musicGuilds[guild.id].errored = true;
        }
        else if (musicGuilds[guild.id].errored) {
            additionalInfo = "Skipping the track.";
            let original = musicGuilds[guild.id].queue;
            const shifted = original.shift();
            musicGuilds[guild.id].queue = original;
            delete musicGuilds[guild.id].skip;
            delete musicGuilds[guild.id].errored;
            if (original.length === 0) {next = null;}
            else {next = original[0].track;}
            play(guild, next, false, false);
        }
        musicGuilds[guild.id].channel.createMessage({
            embed: {
                description: `An error occurred while playing **[${title}](${uri})**.\n${additionalInfo}`,
                color: 0xf39bff
            }
        });
    });
    player.on("end", d => {
        if (d.reason && d.reason === 'REPLACED') {return;}
        let totalDuration = 0;
        musicGuilds[guild.id].queue.forEach(track => {
            if (track.info) {
                totalDuration += track.info.length;
            }
        });
        let original = musicGuilds[guild.id].queue;
        const shifted = original.shift();
        // Loop logic
        if (musicGuilds[guild.id].loop && shifted) {
            // Preventing loop if track / queue duration is too short, because this causes ratelimits really quickly
            if ((original.length === 0 && shifted.info.length < 60000) || totalDuration < 60000) {
                musicGuilds[guild.id].channel.createMessage({
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
        musicGuilds[guild.id].queue = original;
        delete musicGuilds[guild.id].skip;
        delete musicGuilds[guild.id].errored;
        if (original.length === 0) {next = null;}
        else {next = original[0].track;}
        play(guild, next, false, false);
    });
}

function getBar(progress) {
    if (progress < 10) {return "🔘▬▬▬▬▬▬▬▬▬";}
    else if (progress < 20) {return "▬🔘▬▬▬▬▬▬▬▬";}
    else if (progress < 30) {return "▬▬🔘▬▬▬▬▬▬▬";}
    else if (progress < 40) {return "▬▬▬🔘▬▬▬▬▬▬";}
    else if (progress < 50) {return "▬▬▬▬🔘▬▬▬▬▬";}
    else if (progress < 60) {return "▬▬▬▬▬🔘▬▬▬▬";}
    else if (progress < 70) {return "▬▬▬▬▬▬🔘▬▬▬";}
    else if (progress < 80) {return "▬▬▬▬▬▬▬🔘▬▬";}
    else if (progress < 90) {return "▬▬▬▬▬▬▬▬🔘▬";}
    else {return "▬▬▬▬▬▬▬▬▬🔘";}
}

module.exports.musicGuilds = musicGuilds;
module.exports.querySorter = querySorter;
module.exports.resolveTracks = resolveTracks;
module.exports.getPlayer = getPlayer;
module.exports.trackHandler = trackHandler;
module.exports.queueHandler = queueHandler;
module.exports.getBar = getBar;