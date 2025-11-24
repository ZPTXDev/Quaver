import { QuaverGuild, WhitelistStatus } from '#src/lib/guild';
import { PlayerResponse } from '#src/lib/music';
import {
    acceptableSources,
    Check,
    getFailedChecks,
    getRequesterStatus,
    type QuaverChannels,
    type QuaverSong,
    queryOverrides,
    RequesterStatus,
    settings,
} from '#src/lib/util';
import {
    type APIGuild,
    type APIUser,
    ChannelType,
    GuildMember,
    PermissionsBitField,
    type Snowflake,
} from 'discord.js';
import { LavalinkWSClientState } from 'lavalink-ws-client';
import type { Socket } from 'socket.io';

export default {
    name: 'update',
    once: false,
    async execute(
        socket: Socket & { guilds: APIGuild[]; user: APIUser },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: (cb: Record<string, any>) => void,
        guildId: Snowflake,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        item: { type: UpdateItemType; value?: any },
    ): Promise<void> {
        const { client } = await import('#src/main');
        if (!socket.guilds) {
            return callback({ status: Response.AuthenticationError });
        }
        if (!socket.guilds.find((guild): boolean => guild.id === guildId)) {
            return callback({ status: Response.AuthenticationError });
        }
        const guild = await QuaverGuild.wrap(client.guilds.cache.get(guildId));
        if (
            ![
                UpdateItemType.StayFeature,
                UpdateItemType.AutoLyricsFeature,
                UpdateItemType.SmartQueueFeature,
                UpdateItemType.Add,
            ].includes(item.type) &&
            (await guild?.members.fetch(socket.user.id))?.voice.channelId !==
                guild.members.me.voice.channelId
        ) {
            return callback({ status: Response.ChannelMismatchError });
        }
        switch (item.type) {
            case UpdateItemType.Add: {
                const member = await guild.members.fetch(socket.user.id);
                if (!(member instanceof GuildMember)) {
                    return callback({ status: Response.GenericError });
                }
                const failedChecks: Check[] = await getFailedChecks(
                    [Check.InVoice, Check.InSessionVoice],
                    guild.id,
                    member as GuildMember & { client: typeof client },
                );
                if (failedChecks.length > 0) {
                    return callback({ status: Response.UserNotInChannelError });
                }
                const permissions = member.voice.channel?.permissionsFor(
                    client.user.id,
                );
                if (
                    !permissions.has(
                        new PermissionsBitField([
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.Connect,
                            PermissionsBitField.Flags.Speak,
                        ]),
                    ) ||
                    (member.voice.channel.type ===
                        ChannelType.GuildStageVoice &&
                        !permissions.has(PermissionsBitField.StageModerator))
                ) {
                    return callback({ status: Response.BotPermissionError });
                }
                let me = await guild.members.fetchMe();
                if (me.isCommunicationDisabled()) {
                    return callback({ status: Response.BotTimedOutError });
                }
                if (client.music.ws.state !== LavalinkWSClientState.Ready) {
                    return callback({ status: Response.NotReadyError });
                }
                const query = item.value;
                let tracks = [];
                let searchQuery;
                if (queryOverrides.some((q): boolean => query.startsWith(q))) {
                    searchQuery = query;
                } else {
                    const source =
                        (await guild.settings.get<string>('source')) ??
                        Object.keys(acceptableSources)[0];
                    searchQuery = `${acceptableSources[source]}${query}`;
                }
                const result = await client.music.api.loadTracks(searchQuery);
                switch (result.loadType) {
                    case 'playlist':
                        tracks = [
                            ...result.data.tracks.map(
                                (t: QuaverSong): QuaverSong => {
                                    t.requesterId = socket.user.id;
                                    t.id = crypto.randomUUID();
                                    return t;
                                },
                            ),
                        ];
                        break;
                    case 'track':
                    case 'search': {
                        const track: QuaverSong =
                            result.loadType === 'search'
                                ? result.data[0]
                                : result.data;
                        track.requesterId = socket.user.id;
                        track.id = crypto.randomUUID();
                        tracks = [track];
                        break;
                    }
                    case 'empty':
                        return callback({
                            status: Response.NoResultsError,
                        });
                    case 'error':
                    default:
                        return callback({ status: Response.GenericError });
                }
                let player = await client.music.players.fetch(guild.id);
                if (!player?.voice.connected) {
                    player = client.music.players.create(guild);
                    player.queue.channel = member.voice
                        .channel as QuaverChannels;
                    player.voice.connect(member.voice.channelId, {
                        deafened: true,
                    });
                    // Ensure that Quaver destroys the player if the user leaves the channel while Quaver is queuing tracks
                    // Ensure that Quaver destroys the player if Quaver gets timed out by the user while Quaver is queuing tracks
                    // Ensure that Quaver destroys the player if Quaver gets kicked or banned by the user while Quaver is queuing tracks
                    me = await guild.members.fetchMe();
                    const timedOut = me.isCommunicationDisabled();
                    if (!member.voice.channelId || timedOut || !guild) {
                        await player.disconnect();
                        return callback({ status: Response.GenericError });
                    }
                    const smartQueue =
                        await guild.settings.get<boolean>('smartqueue');
                    if (smartQueue) {
                        await player.setAlternate(true);
                    }
                }
                await player.addTracksToQueue(tracks);
                guild.sendWebUpdate(
                    'queueUpdate',
                    player.queue.tracks.map((track: QuaverSong): QuaverSong => {
                        const user = client.users.cache.get(track.requesterId);
                        track.requesterTag = user?.tag;
                        track.requesterAvatar = user?.avatar;
                        return track;
                    }),
                );
                break;
            }
            case UpdateItemType.Loop: {
                const player = await client.music.players.fetch(guild.id);
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                await player.setLoopMode(item.value);
                break;
            }
            case UpdateItemType.Volume: {
                const player = await client.music.players.fetch(guild.id);
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const response = await player.setVolumeTo(item.value);
                if (response !== PlayerResponse.Success) {
                    return callback({ status: Response.GenericError });
                }
                break;
            }
            case UpdateItemType.Paused: {
                const player = await client.music.players.fetch(guild.id);
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const response = await player.setPause(item.value);
                if (response !== PlayerResponse.Success) {
                    return callback({ status: Response.GenericError });
                }
                break;
            }
            case UpdateItemType.Skip: {
                const player = await client.music.players.fetch(guild.id);
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const requesterStatus = await getRequesterStatus(
                    player.queue.current,
                    (await guild.members.fetch(socket.user.id)) as GuildMember,
                    player.queue.channel,
                );
                if (requesterStatus !== RequesterStatus.NotRequester) {
                    const response = await player.skipCurrentTrack();
                    if (response !== PlayerResponse.Success) {
                        return callback({ status: Response.GenericError });
                    }
                    break;
                }
                const skip = player.memory.skip ?? {
                    required: Math.ceil(
                        (
                            await guild.members.fetchMe()
                        ).voice.channel.members.filter(
                            (m): boolean => !m.user.bot,
                        ).size / 2,
                    ),
                    users: [],
                };
                if (skip.users.includes(socket.user.id)) {
                    return callback({ status: Response.GenericError });
                }
                skip.users.push(socket.user.id);
                if (skip.users.length >= skip.required) {
                    const response = await player.skipCurrentTrack();
                    if (response !== PlayerResponse.Success) {
                        return callback({ status: Response.GenericError });
                    }
                    break;
                }
                player.memory.skip = skip;
                break;
            }
            case UpdateItemType.Bassboost: {
                const player = await client.music.players.fetch(guild.id);
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                await player.setBassboost(item.value);
                break;
            }
            case UpdateItemType.Nightcore: {
                const player = await client.music.players.fetch(guild.id);
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                await player.setNightcore(item.value);
                break;
            }
            case UpdateItemType.Seek: {
                const player = await client.music.players.fetch(guild.id);
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const requesterStatus = await getRequesterStatus(
                    player.queue.current,
                    (await client.guilds.cache
                        .get(guildId)
                        .members.fetch(socket.user.id)) as GuildMember,
                    player.queue.channel,
                );
                if (requesterStatus === RequesterStatus.NotRequester) {
                    return callback({ status: Response.AuthenticationError });
                }
                const response = await player.seekTo(item.value);
                if (response !== PlayerResponse.Success) {
                    return callback({ status: Response.GenericError });
                }
                break;
            }
            case UpdateItemType.Remove: {
                const player = await client.music.players.fetch(guild.id);
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const track = player.queue.tracks[item.value];
                if (!track) return callback({ status: Response.GenericError });
                const requesterStatus = await getRequesterStatus(
                    player.queue.tracks[item.value],
                    (await client.guilds.cache
                        .get(guildId)
                        .members.fetch(socket.user.id)) as GuildMember,
                    player.queue.channel,
                );
                if (requesterStatus === RequesterStatus.NotRequester) {
                    return callback({ status: Response.AuthenticationError });
                }
                const response = await player.removeQueuedTrack(item.value + 1);
                if (response !== PlayerResponse.Success) {
                    return callback({ status: Response.GenericError });
                }
                break;
            }
            case UpdateItemType.Shuffle: {
                const player = await client.music.players.fetch(guild.id);
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                await player.setShuffle(item.value);
                break;
            }
            case UpdateItemType.StayFeature: {
                const player = await client.music.players.fetch(guild.id);
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const member = await guild.members.fetch(socket.user.id);
                if (!(member instanceof GuildMember)) {
                    return callback({ status: Response.GenericError });
                }
                const failedChecks: Check[] = await getFailedChecks(
                    [Check.InVoice, Check.InSessionVoice],
                    guild.id,
                    member as GuildMember & { client: typeof client },
                );
                if (failedChecks.length > 0) {
                    return callback({ status: Response.UserNotInChannelError });
                }
                const response = await player.setStay(item.value);
                switch (response) {
                    case PlayerResponse.FeatureDisabled:
                        return callback({
                            status: Response.FeatureDisabledError,
                        });
                    case PlayerResponse.FeatureNotWhitelisted:
                        return callback({
                            status: Response.FeatureNotWhitelistedError,
                        });
                    case PlayerResponse.QueueChannelMissing:
                        return callback({
                            status: Response.InactiveSessionError,
                        });
                }
                break;
            }
            case UpdateItemType.AutoLyricsFeature: {
                if (
                    !(
                        await guild?.members.fetch(socket.user.id)
                    )?.permissions.has(PermissionsBitField.Flags.ManageGuild)
                ) {
                    return callback({ status: Response.AuthenticationError });
                }
                if (item.value === true) {
                    if (!settings.features.autolyrics.enabled) {
                        return callback({
                            status: Response.FeatureDisabledError,
                        });
                    }
                    const whitelisted =
                        await guild.features.checkWhitelisted('autolyrics');
                    if (
                        whitelisted === WhitelistStatus.NotWhitelisted ||
                        whitelisted === WhitelistStatus.Expired
                    ) {
                        return callback({
                            status: Response.FeatureNotWhitelistedError,
                        });
                    }
                }
                await guild.settings.set('autolyrics', item.value);
                guild.sendWebUpdate('autoLyricsFeatureUpdate', {
                    enabled: item.value,
                });
                break;
            }
            case UpdateItemType.SmartQueueFeature: {
                if (
                    !(
                        await guild?.members.fetch(socket.user.id)
                    )?.permissions.has(PermissionsBitField.Flags.ManageGuild)
                ) {
                    return callback({ status: Response.AuthenticationError });
                }
                if (item.value === true) {
                    if (!settings.features.smartqueue.enabled) {
                        return callback({
                            status: Response.FeatureDisabledError,
                        });
                    }
                    const whitelisted =
                        await guild.features.checkWhitelisted('smartqueue');
                    if (
                        whitelisted === WhitelistStatus.NotWhitelisted ||
                        whitelisted === WhitelistStatus.Expired
                    ) {
                        return callback({
                            status: Response.FeatureNotWhitelistedError,
                        });
                    }
                }
                await guild.settings.set('smartqueue', item.value);
                guild.sendWebUpdate('smartQueueFeatureUpdate', {
                    enabled: item.value,
                });
                break;
            }
        }
        return callback({ status: Response.Success });
    },
};

export enum UpdateItemType {
    Add = 'add',
    Loop = 'loop',
    Volume = 'volume',
    Paused = 'paused',
    Skip = 'skip',
    Bassboost = 'bassboost',
    Nightcore = 'nightcore',
    Seek = 'seek',
    Remove = 'remove',
    Shuffle = 'shuffle',
    StayFeature = 'stayFeature',
    AutoLyricsFeature = 'autoLyricsFeature',
    SmartQueueFeature = 'smartQueueFeature',
}

enum Response {
    Success = 'success',
    AuthenticationError = 'error-auth',
    GenericError = 'error-generic',
    ChannelMismatchError = 'error-channel-mismatch',
    InactiveSessionError = 'error-inactive-session',
    FeatureDisabledError = 'error-feature-disabled',
    FeatureNotWhitelistedError = 'error-feature-not-whitelisted',
    BotPermissionError = 'error-bot-permission',
    BotTimedOutError = 'error-bot-timed-out',
    NoResultsError = 'error-no-results',
    UserNotInChannelError = 'error-user-not-in-channel',
    NotReadyError = 'error-not-ready',
}
