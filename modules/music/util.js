const superagent = require('superagent');

function querySorter (query) {
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
    if (!channel || !channel.guild) {
        return Promise.reject('Not a guild channel.');
    }
    let player = bot.voiceConnections.get(channel.guild.id);
    if (player) {
        return Promise.resolve(player);
    }
    return bot.joinVoiceChannel(channel.id);
}

function trackHandler (tracks, type, search) {
    if (["LOAD_FAILED", "UNKNOWN", "NO_MATCHES"].includes(tracks.loadType) || tracks.tracks.length == 0) {
        return tracks.loadType;
    }
    else if (tracks.loadType == "TRACK_LOADED" && ["id", "url"].includes(type)) {
        return tracks.tracks[0];
    }
    else if (tracks.loadType == "SEARCH_RESULT" && ["default", "ytsearch", "scsearch"].includes(type)) {
        if (!search) {return tracks.tracks[0];}
        else {return tracks.tracks;}
    }
    else if (tracks.loadType == "PLAYLIST_LOADED" && type == "url") {
        return;
    }
    else {
        return "UNKNOWN";
    }
  }

module.exports.querySorter = querySorter;
module.exports.resolveTracks = resolveTracks;
module.exports.getPlayer = getPlayer;
module.exports.trackHandler = trackHandler;