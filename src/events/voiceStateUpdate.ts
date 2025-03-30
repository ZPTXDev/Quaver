import type { QuaverClient, QuaverPlayer } from '#src/lib/util/common.d.js';
import {
    MessageOptionsBuilderType,
    data,
    logger,
} from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString } from '#src/lib/util/util.js';
import type { GuildMember, VoiceState } from 'discord.js';
import {
    ChannelType,
    EmbedBuilder,
    PermissionsBitField,
    StageInstancePrivacyLevel,
} from 'discord.js';
import type { DefaultEventsMap, Server } from 'socket.io';

const PAUSE_TIMEOUT_SECONDS = 5 * 60;

const guildDatabase = data.guild;

function isUser(member: GuildMember): boolean {
    return !member.user.bot;
}

async function pauseChannelSession(
    io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
    player: QuaverPlayer,
): Promise<void> {
    await player.pause();
    const playerId = player.id;
    if (settings.features.web.enabled) {
        io.to(`guild:${playerId}`).emit('pauseUpdate', player.paused);
    }
    logger.info({
        message: `[G ${playerId}] Setting pause timeout`,
        label: 'Quaver',
    });
    // As a failsafe, clear the pauseTimeout first before setting a new pauseTimeout
    clearTimeout(player.pauseTimeout);
    player.pauseTimeout = null;
    player.pauseTimeout = setTimeout(
        (p): void => {
            const pHandler = p.handler;
            logger.info({
                message: `[G ${p.id}] Disconnecting (inactivity)`,
                label: 'Quaver',
            });
            pHandler.locale('MUSIC.DISCONNECT.INACTIVITY.DISCONNECTED', {
                type: MessageOptionsBuilderType.Warning,
            });
            pHandler.disconnect();
        },
        PAUSE_TIMEOUT_SECONDS * 1000,
        player,
    );
    player.timeoutEnd = Date.now() + PAUSE_TIMEOUT_SECONDS * 1000;
    if (settings.features.web.enabled) {
        io.to(`guild:${playerId}`).emit(
            'pauseTimeoutUpdate',
            player.timeoutEnd,
        );
    }
    await player.handler.send(
        new EmbedBuilder()
            .setDescription(
                `${await getGuildLocaleString(
                    playerId,
                    'MUSIC.DISCONNECT.ALONE.WARNING',
                )} ${await getGuildLocaleString(
                    playerId,
                    'MUSIC.DISCONNECT.INACTIVITY.WARNING',
                    (
                        Math.floor(Date.now() / 1000) + PAUSE_TIMEOUT_SECONDS
                    ).toString(),
                )}`,
            )
            .setFooter({
                text: await getGuildLocaleString(
                    playerId,
                    'MUSIC.DISCONNECT.ALONE.REJOIN_TO_RESUME',
                ),
            }),
        { type: MessageOptionsBuilderType.Warning },
    );
}

async function resumeChannelSession(
    io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
    player: QuaverPlayer,
): Promise<void> {
    const playerId = player.id;
    logger.info({
        message: `[G ${playerId}] Resuming session`,
        label: 'Quaver',
    });
    await player.resume();
    clearTimeout(player.pauseTimeout);
    player.pauseTimeout = null;
    if (settings.features.web.enabled) {
        io.to(`guild:${playerId}`).emit('pauseUpdate', player.paused);
        io.to(`guild:${playerId}`).emit(
            'pauseTimeoutUpdate',
            !!player.pauseTimeout,
        );
    }
    await player.handler.locale('MUSIC.DISCONNECT.ALONE.RESUMING', {
        type: MessageOptionsBuilderType.Success,
    });
}

// isOldQuaverStateUpdate is the context whether the state update belongs to Quaver
async function onChannelEmpty(
    io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
    player: QuaverPlayer,
    oldState: VoiceState,
    isOldQuaverStateUpdate: boolean,
    isGuildStayEnabled: boolean | unknown,
): Promise<void> {
    const playerId = player.id;
    const isPlayerIdle =
        !player.queue.current || (!player.playing && !player.paused);
    // To ensure Quaver does not persist in an inactive session, disable stay feature for this guild
    if (isOldQuaverStateUpdate && isPlayerIdle && isGuildStayEnabled) {
        await guildDatabase.set(playerId, 'settings.stay.enabled', false);
    }
    const playerHandler = player.handler;
    if (isPlayerIdle) {
        logger.info({
            message: `[G ${playerId}] Disconnecting (alone)`,
            label: 'Quaver',
        });
        await playerHandler.locale(
            isOldQuaverStateUpdate
                ? 'MUSIC.DISCONNECT.ALONE.DISCONNECTED.MOVED'
                : 'MUSIC.DISCONNECT.ALONE.DISCONNECTED.DEFAULT',
            { type: MessageOptionsBuilderType.Warning },
        );
        await playerHandler.disconnect();
        return;
    }
    const playerVoice = player.voice;
    const playerVoiceChannelId = playerVoice.channelId;
    // To ensure that Quaver does not set pauseTimeout if timeout or pauseTimeout already exists, do not pause the session
    // To ensure that Quaver does not set a pauseTimeout after a stage ends, do not pause the session
    if (player.timeout || player.pauseTimeout || !playerVoiceChannelId) {
        return;
    }
    const voiceChannel = oldState.client.guilds.cache
        .get(playerId)
        .channels.cache.get(playerVoiceChannelId);
    // From commit https://github.com/ZPTXDev/Quaver/commit/6f405c5dce1a94cf788000229070ae8a8eeef7cb
    // This check will be removed once confirmed to be redundant
    if (
        voiceChannel.type === ChannelType.GuildStageVoice &&
        !voiceChannel.stageInstance
    ) {
        return;
    }
    await pauseChannelSession(io, player);
}

async function onChannelJoinOrMove(
    io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
    player: QuaverPlayer,
    oldState: VoiceState,
    newState: VoiceState,
    isGuildStayEnabled: boolean | unknown,
    isOldQuaverStateUpdate: boolean,
): Promise<void> {
    const guildStayChannelId = await guildDatabase.get(
        player.id,
        'settings.stay.channel',
    );
    if (isGuildStayEnabled && guildStayChannelId !== newState.channelId) {
        await guildDatabase.set(
            player.id,
            'settings.stay.channel',
            newState.channelId,
        );
    }
    // newState#channel is always defined for join/move states, so optional chaining is unnecessary
    const hasNewChannelUsers = newState.channel.members.filter(isUser).size > 0;
    if (hasNewChannelUsers && player.pauseTimeout) {
        await resumeChannelSession(io, player);
    }
    // To prevent Quaver from handling a channel that still has users or the guild's stay feature is enabled, do not handle the channel
    if (hasNewChannelUsers || isGuildStayEnabled) {
        return;
    }
    await onChannelEmpty(
        io,
        player,
        oldState,
        isOldQuaverStateUpdate,
        isGuildStayEnabled,
    );
}

export default {
    name: 'voiceStateUpdate',
    once: false,
    async execute(oldState: VoiceState, newState: VoiceState): Promise<void> {
        const oldClient = oldState.client as QuaverClient;
        const oldClientUserId = oldClient.user.id;
        const oldUser = oldState.member.user;
        const isOldQuaverStateUpdate = oldUser.id === oldClientUserId;
        // Since we don't handle state updates for another bot, do not operate
        if (!isOldQuaverStateUpdate && oldUser.bot) {
            return;
        }
        const oldChannelId = oldState.channelId;
        const newChannelId = newState.channelId;
        const isSameChannel = oldChannelId === newChannelId;
        const isNewSuppress = newState.suppress;
        // Since Quaver is expected to continue playback despite these state updates, do not operate
        if (
            isOldQuaverStateUpdate &&
            isSameChannel &&
            (oldState.suppress !== isNewSuppress ||
                oldState.serverMute !== newState.serverMute ||
                oldState.serverDeaf !== newState.serverDeaf)
        ) {
            return;
        }
        const oldGuildId = oldState.guild.id;
        const player = (await oldClient.music.players.fetch(
            oldGuildId,
        )) as QuaverPlayer;
        // To prevent further operations on an uninitialized player session / player handler, do not operate
        if (!player) {
            return;
        }
        const playerHandler = player.handler;
        if (!playerHandler) {
            return;
        }
        const playerId = player.id;
        const isGuildStayEnabled = await guildDatabase.get(
            playerId,
            'settings.stay.enabled',
        );
        const playerVoice = player.voice;
        const hasQuaverDisconnected = isOldQuaverStateUpdate && !newChannelId;
        // To ensure it does not persist in an inactive session, disable stay for this guild
        if (hasQuaverDisconnected && isGuildStayEnabled) {
            await guildDatabase.set(playerId, 'settings.stay.enabled', false);
        }
        // To reset states, properly handle disconnection
        if (hasQuaverDisconnected) {
            logger.info({
                message: `[G ${playerId}] Cleaning up (disconnected)`,
                label: 'Quaver',
            });
            playerVoice.channelId = null;
            await playerHandler.locale(
                'MUSIC.SESSION_ENDED.FORCED.DISCONNECTED',
                { type: MessageOptionsBuilderType.Warning },
            );
            await playerHandler.disconnect(oldChannelId);
            return;
        }
        const { io } = await import('#src/main.js');
        // To prevent Quaver from remaining suppressed when suppression is attempted mid-track,
        // explicitly use booleans for Quaver's state update and newState#channelId
        const isQuaverJoinOrMoveState = isOldQuaverStateUpdate && newChannelId;
        const newChannel = newState.channel;
        // In this context, newState#channel can be null because of leave states, so optional chaining is necessary
        const newChannelType = newChannel?.type;
        // To keep the dashboard updated with the latest session details, emit channel events for this guild
        if (isQuaverJoinOrMoveState && settings.features.web.enabled) {
            io.to(`guild:${playerId}`).emit(
                'textChannelUpdate',
                player.queue.channel.name,
            );
            io.to(`guild:${playerId}`).emit('channelUpdate', newChannel?.name);
        }
        // For type consistency, create an empty map for unhandled states
        const channelPermissions = isQuaverJoinOrMoveState
            ? oldClient.guilds.cache
                  .get(oldGuildId)
                  .channels.cache.get(newChannelId)
                  .permissionsFor(oldClientUserId)
            : new Map();
        const hasBasicChannelPermissions = channelPermissions.has(
            new PermissionsBitField([
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
            ]),
        );
        if (
            isQuaverJoinOrMoveState &&
            newChannelType === ChannelType.GuildVoice
        ) {
            // To prevent permission errors, properly disconnect Quaver
            if (!hasBasicChannelPermissions) {
                await playerHandler.locale(
                    'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC',
                    { type: MessageOptionsBuilderType.Error },
                );
                await playerHandler.disconnect();
                return;
            }
            await onChannelJoinOrMove(
                io,
                player,
                oldState,
                newState,
                isGuildStayEnabled,
                isOldQuaverStateUpdate,
            );
            return;
        }
        if (
            isQuaverJoinOrMoveState &&
            newChannelType === ChannelType.GuildStageVoice &&
            isNewSuppress
        ) {
            // To prevent permission errors, properly disconnect Quaver
            if (!hasBasicChannelPermissions) {
                await playerHandler.locale(
                    'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC',
                    { type: MessageOptionsBuilderType.Error },
                );
                await playerHandler.disconnect();
                return;
            }
            const hasStageModerator = channelPermissions.has(
                PermissionsBitField.StageModerator,
            );
            if (!hasStageModerator && isGuildStayEnabled) {
                await guildDatabase.set(
                    playerId,
                    'settings.stay.enabled',
                    false,
                );
            }
            if (!hasStageModerator) {
                await playerHandler.locale(
                    'MUSIC.SESSION_ENDED.FORCED.STAGE_NOT_MODERATOR',
                    { type: MessageOptionsBuilderType.Warning },
                );
                await playerHandler.disconnect();
                return;
            }
            // To avoid errors from recreating a stage instance, only create one if it doesn't already exist
            if (!newChannel.stageInstance) {
                try {
                    await newChannel.createStageInstance({
                        topic: await getGuildLocaleString(
                            playerId,
                            'MISC.STAGE_TOPIC',
                        ),
                        privacyLevel: StageInstancePrivacyLevel.GuildOnly,
                    });
                } catch (error) {
                    if (error instanceof Error) {
                        logger.error({
                            message: `${error.message}\n${error.stack}`,
                            label: 'Quaver',
                        });
                    }
                }
            }
            // To prevent a regression bug where in Quaver remains silent in Stage channels, unsuppress Quaver after stage instance creation
            await newState.setSuppressed(false);
            await onChannelJoinOrMove(
                io,
                player,
                oldState,
                newState,
                isGuildStayEnabled,
                isOldQuaverStateUpdate,
            );
            return;
        }
        // Since a user joined Quaver's channel while the session was paused, resume the session
        if (
            !isOldQuaverStateUpdate &&
            newChannelId === playerVoice.channelId &&
            player.pauseTimeout
        ) {
            await resumeChannelSession(io, player);
            return;
        }
        const hasUserLeftQuaverChannel =
            !isOldQuaverStateUpdate &&
            !newChannelId &&
            oldChannelId === playerVoice.channelId;
        // Since the last user left Quaver's channel and the guild's stay feature is disabled, handle the empty channel
        // In this context, oldState#channel is always defined for leave states, so optional chaining is unnecessary
        if (
            hasUserLeftQuaverChannel &&
            oldState.channel.members.filter(isUser).size < 1 &&
            !isGuildStayEnabled
        ) {
            await onChannelEmpty(
                io,
                player,
                oldState,
                isOldQuaverStateUpdate,
                isGuildStayEnabled,
            );
        }
    },
};
