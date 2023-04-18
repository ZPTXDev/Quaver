import { PlayerResponse } from '#src/lib/PlayerHandler.js';
import type { QuaverPlayer } from '#src/lib/util/common.d.js';
import { data } from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import {
    getGuildFeatureWhitelisted,
    getRequesterStatus,
    RequesterStatus,
    WhitelistStatus,
} from '#src/lib/util/util.js';
import type { APIGuild, APIUser, GuildMember, Snowflake } from 'discord.js';
import { PermissionsBitField } from 'discord.js';
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
            ].includes(item.type) &&
            bot.guilds.cache.get(guildId)?.members.cache.get(socket.user.id)
                ?.voice.channelId !==
                bot.guilds.cache.get(guildId).members.me.voice.channelId
        ) {
            return callback({ status: Response.ChannelMismatchError });
        }
        switch (item.type) {
            case UpdateItemType.Loop: {
                const player = bot.music.players.get(guildId) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                await player.handler.loop(item.value);
                break;
            }
            case UpdateItemType.Volume: {
                const player = bot.music.players.get(guildId) as QuaverPlayer;
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
                const player = bot.music.players.get(guildId) as QuaverPlayer;
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
                const player = bot.music.players.get(guildId) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const requesterStatus = await getRequesterStatus(
                    player.queue.current,
                    bot.guilds.cache
                        .get(guildId)
                        .members.cache.get(socket.user.id) as GuildMember,
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
                        bot.guilds.cache
                            .get(guildId)
                            .members.me.voice.channel.members.filter(
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
                const player = bot.music.players.get(guildId) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                await player.handler.bassboost(item.value);
                break;
            }
            case UpdateItemType.Nightcore: {
                const player = bot.music.players.get(guildId) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                await player.handler.nightcore(item.value);
                break;
            }
            case UpdateItemType.Seek: {
                const player = bot.music.players.get(guildId) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const requesterStatus = await getRequesterStatus(
                    player.queue.current,
                    bot.guilds.cache
                        .get(guildId)
                        .members.cache.get(socket.user.id) as GuildMember,
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
                const player = bot.music.players.get(guildId) as QuaverPlayer;
                if (!player) {
                    return callback({ status: Response.InactiveSessionError });
                }
                const response = await player.handler.remove(item.value + 1);
                if (response !== PlayerResponse.Success) {
                    return callback({ status: Response.GenericError });
                }
                break;
            }
            case UpdateItemType.Shuffle: {
                const player = bot.music.players.get(guildId) as QuaverPlayer;
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
                const player = bot.music.players.get(guildId) as QuaverPlayer;
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
                    bot.guilds.cache
                        .get(guildId)
                        ?.members.cache.get(socket.user.id)
                        ?.permissions.missing(
                            PermissionsBitField.Flags.ManageGuild,
                        )
                ) {
                    return callback({ status: Response.AuthenticationError });
                }
                if (item.value) {
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
                    bot.guilds.cache
                        .get(guildId)
                        ?.members.cache.get(socket.user.id)
                        ?.permissions.missing(
                            PermissionsBitField.Flags.ManageGuild,
                        )
                ) {
                    return callback({ status: 'error-auth' });
                }
                if (item.value) {
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
}
