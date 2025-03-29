import PlayerHandler, { PlayerResponse } from '#src/lib/PlayerHandler.js';
import type {
    QuaverChannels,
    QuaverPlayer,
    QuaverSong,
} from '#src/lib/util/common.d.js';
import { data } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import {
    getFailedChecks,
    getGuildFeatureWhitelisted,
    getQueryOverrides,
    getRequesterStatus,
    RequesterStatus,
    WhitelistStatus,
} from '#src/lib/util/util.js';
import type { APIGuild, APIUser, Snowflake } from 'discord.js';
import { ChannelType, GuildMember, PermissionsBitField } from 'discord.js';
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
        const { bot, io } = await import('#src/main.js');
        if (!socket.guilds) {
            return callback({ status: Response.AuthenticationError });
        }
        if (!socket.guilds.find((guild): boolean => guild.id === guildId)) {
            return callback({ status: Response.AuthenticationError });
        }
        if (
            ![
                UpdateItemType.StayFeature,
                UpdateItemType.AutoLyricsFeature,
                UpdateItemType.SmartQueueFeature,
                UpdateItemType.Add,
            ].includes(item.type) &&
            (await bot.guilds.cache.get(guildId)?.members.fetch(socket.user.id))
                ?.voice.channelId !==
                bot.guilds.cache.get(guildId).members.me.voice.channelId
        ) {
            return callback({ status: Response.ChannelMismatchError });
        }
        switch (item.type) {
            case UpdateItemType.Add: {
                const member = await bot.guilds.cache
                    .get(guildId)
                    .members.fetch(socket.user.id);
                if (!(member instanceof GuildMember)) {
                    return callback({ status: Response.GenericError });
                }
                const failedChecks: Check[] = await getFailedChecks(
                    [Check.InVoice, Check.InSessionVoice],
                    guildId,
                    member,
                );
                if (failedChecks.length > 0) {
                    return callback({ status: Response.UserNotInChannelError });
                }
                const permissions = member.voice.channel?.permissionsFor(
                    bot.user.id,
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
                let me = await bot.guilds.cache.get(guildId).members.fetchMe();
                if (me.isCommunicationDisabled()) {
                    return callback({ status: Response.BotTimedOutError });
                }
                const query = item.value;
                let tracks = [];
                const result = await bot.music.api.loadTracks(
                    getQueryOverrides().some((q): boolean =>
                        query.startsWith(q),
                    )
                        ? query
                        : `ytmsearch:${query}`,
                );
                switch (result.loadType) {
                    case 'playlist':
                        tracks = [...result.data.tracks];
                        break;
                    case 'track':
                    case 'search': {
                        const track =
                            result.loadType === 'search'
                                ? result.data[0]
                                : result.data;
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
                let player = (await bot.music.players.fetch(
                    guildId,
                )) as QuaverPlayer;
                if (!player?.voice.connected) {
                    player = bot.music.players.create(guildId) as QuaverPlayer;
                    player.handler = new PlayerHandler(bot, player);
                    player.queue.channel = member.voice
                        .channel as QuaverChannels;
                    await player.voice.connect(member.voice.channelId, {
                        deafened: true,
                    });
                    // Ensure that Quaver destroys the player if the user leaves the channel while Quaver is queuing tracks
                    // Ensure that Quaver destroys the player if Quaver gets timed out by the user while Quaver is queuing tracks
                    // Ensure that Quaver destroys the player if Quaver gets kicked or banned by the user while Quaver is queuing tracks
                    me = await bot.guilds.cache.get(guildId).members.fetchMe();
                    const timedOut = me.isCommunicationDisabled();
                    if (
                        !member.voice.channelId ||
                        timedOut ||
                        !bot.guilds.cache.get(guildId)
                    ) {
                        await player.handler.disconnect();
                        return callback({ status: Response.GenericError });
                    }
                }
                player.queue.add(tracks, {
                    requester: socket.user.id,
                    next: false,
                });
                const started = player.playing || player.paused;
                const smartQueue = await data.guild.get<boolean>(
                    guildId,
                    'settings.smartqueue',
                );
                if (!started) await player.queue.start();
                if (smartQueue) await player.handler.sort();
                if (settings.features.web.enabled) {
                    io.to(`guild:${guildId}`).emit(
                        'queueUpdate',
                        player.queue.tracks.map(
                            (track: QuaverSong): QuaverSong => {
                                const user = bot.users.cache.get(
                                    track.requesterId,
                                );
                                track.requesterTag = user?.tag;
                                track.requesterAvatar = user?.avatar;
                                return track;
                            },
                        ),
                    );
                }
                break;
            }
            case UpdateItemType.Loop: {
                const player = (await bot.music.players.fetch(
                    guildId,
                )) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                await player.handler.loop(item.value);
                break;
            }
            case UpdateItemType.Volume: {
                const player = (await bot.music.players.fetch(
                    guildId,
                )) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const response = await player.handler.volume(item.value);
                if (response !== PlayerResponse.Success) {
                    return callback({ status: Response.GenericError });
                }
                break;
            }
            case UpdateItemType.Paused: {
                const player = (await bot.music.players.fetch(
                    guildId,
                )) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const response = item.value
                    ? await player.handler.pause()
                    : await player.handler.resume();
                if (response !== PlayerResponse.Success) {
                    return callback({ status: Response.GenericError });
                }
                break;
            }
            case UpdateItemType.Skip: {
                const player = (await bot.music.players.fetch(
                    guildId,
                )) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const requesterStatus = await getRequesterStatus(
                    player.queue.current,
                    (await bot.guilds.cache
                        .get(guildId)
                        .members.fetch(socket.user.id)) as GuildMember,
                    player.queue.channel,
                );
                if (requesterStatus !== RequesterStatus.NotRequester) {
                    const response = await player.handler.skip();
                    if (response !== PlayerResponse.Success) {
                        return callback({ status: Response.GenericError });
                    }
                    break;
                }
                const skip = player.skip ?? {
                    required: Math.ceil(
                        (
                            await bot.guilds.cache
                                .get(guildId)
                                .members.fetchMe()
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
                    const response = await player.handler.skip();
                    if (response !== PlayerResponse.Success) {
                        return callback({ status: Response.GenericError });
                    }
                    break;
                }
                player.skip = skip;
                break;
            }
            case UpdateItemType.Bassboost: {
                const player = (await bot.music.players.fetch(
                    guildId,
                )) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                await player.handler.bassboost(item.value);
                break;
            }
            case UpdateItemType.Nightcore: {
                const player = (await bot.music.players.fetch(
                    guildId,
                )) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                await player.handler.nightcore(item.value);
                break;
            }
            case UpdateItemType.Seek: {
                const player = (await bot.music.players.fetch(
                    guildId,
                )) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const requesterStatus = await getRequesterStatus(
                    player.queue.current,
                    (await bot.guilds.cache
                        .get(guildId)
                        .members.fetch(socket.user.id)) as GuildMember,
                    player.queue.channel,
                );
                if (requesterStatus === RequesterStatus.NotRequester) {
                    return callback({ status: Response.AuthenticationError });
                }
                const response = await player.handler.seek(item.value);
                if (response !== PlayerResponse.Success) {
                    return callback({ status: Response.GenericError });
                }
                break;
            }
            case UpdateItemType.Remove: {
                const player = (await bot.music.players.fetch(
                    guildId,
                )) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const track = player.queue.tracks[item.value];
                if (!track) return callback({ status: Response.GenericError });
                const requesterStatus = await getRequesterStatus(
                    player.queue.tracks[item.value],
                    (await bot.guilds.cache
                        .get(guildId)
                        .members.fetch(socket.user.id)) as GuildMember,
                    player.queue.channel,
                );
                if (requesterStatus === RequesterStatus.NotRequester) {
                    return callback({ status: Response.AuthenticationError });
                }
                const response = await player.handler.remove(item.value + 1);
                if (response !== PlayerResponse.Success) {
                    return callback({ status: Response.GenericError });
                }
                break;
            }
            case UpdateItemType.Shuffle: {
                const player = (await bot.music.players.fetch(
                    guildId,
                )) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const response = await player.handler.shuffle();
                if (response !== PlayerResponse.Success) {
                    return callback({ status: Response.GenericError });
                }
                break;
            }
            case UpdateItemType.StayFeature: {
                const player = (await bot.music.players.fetch(
                    guildId,
                )) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const response = await player.handler.stay(item.value);
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
                        await bot.guilds.cache
                            .get(guildId)
                            ?.members.fetch(socket.user.id)
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
                    const whitelisted = await getGuildFeatureWhitelisted(
                        guildId,
                        'autolyrics',
                    );
                    if (
                        whitelisted === WhitelistStatus.NotWhitelisted ||
                        whitelisted === WhitelistStatus.Expired
                    ) {
                        return callback({
                            status: Response.FeatureNotWhitelistedError,
                        });
                    }
                }
                await data.guild.set(
                    guildId,
                    'settings.autolyrics',
                    item.value,
                );
                if (settings.features.web.enabled) {
                    io.to(`guild:${guildId}`).emit('autoLyricsFeatureUpdate', {
                        enabled: item.value,
                    });
                }
                break;
            }
            case UpdateItemType.SmartQueueFeature: {
                if (
                    !(
                        await bot.guilds.cache
                            .get(guildId)
                            ?.members.fetch(socket.user.id)
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
                    const whitelisted = await getGuildFeatureWhitelisted(
                        guildId,
                        'smartqueue',
                    );
                    if (
                        whitelisted === WhitelistStatus.NotWhitelisted ||
                        whitelisted === WhitelistStatus.Expired
                    ) {
                        return callback({
                            status: Response.FeatureNotWhitelistedError,
                        });
                    }
                }
                await data.guild.set(
                    guildId,
                    'settings.smartqueue',
                    item.value,
                );
                if (settings.features.web.enabled) {
                    io.to(`guild:${guildId}`).emit('smartQueueFeatureUpdate', {
                        enabled: item.value,
                    });
                }
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
}
