import { MessageOptionsBuilderType, type QuaverClient } from '#src/lib';
import { EventHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import type { QuaverPlayer } from '#src/lib/music';
import {
    ChannelType,
    ContainerBuilder,
    type GuildMember,
    PermissionsBitField,
    StageInstancePrivacyLevel,
    TextDisplayBuilder,
    type VoiceState,
} from 'discord.js';
import type { DefaultEventsMap, Server } from 'socket.io';

const PAUSE_TIMEOUT_SECONDS = 5 * 60;

function isUser(member: GuildMember): boolean {
    return !member.user.bot;
}

async function pauseChannelSession(
    io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
    player: QuaverPlayer,
): Promise<void> {
    const guild = await QuaverGuild.wrap(player.guild);
    await player.pause();
    guild.sendWebUpdate('pauseUpdate', player.paused);
    logger.info({
        message: `[G ${guild.id}] Setting pause timeout`,
        label: 'Quaver',
    });
    // As a failsafe, clear the pauseTimeout first before setting a new pauseTimeout
    clearTimeout(player.timeout.pause);
    player.timeout.pause = null;
    player.timeout.pause = setTimeout(
        (p, g): void => {
            logger.info({
                message: `[G ${g.id}] Disconnecting (inactivity)`,
                label: 'Quaver',
            });
            p.sendMessage(
                g.locale('MUSIC.DISCONNECT.INACTIVITY.DISCONNECTED'),
                {
                    type: MessageOptionsBuilderType.Warning,
                },
            );
            p.disconnect();
        },
        PAUSE_TIMEOUT_SECONDS * 1_000,
        player,
        guild,
    );
    player.timeout.end = Date.now() + PAUSE_TIMEOUT_SECONDS * 1_000;
    guild.sendWebUpdate('pauseTimeoutUpdate', player.timeout.end);
    await player.sendMessage(
        new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${guild.locale(
                    'MUSIC.DISCONNECT.ALONE.WARNING',
                )} ${guild.locale(
                    'MUSIC.DISCONNECT.INACTIVITY.WARNING',
                    (
                        Math.floor(Date.now() / 1000) + PAUSE_TIMEOUT_SECONDS
                    ).toString(),
                )}`,
            ),
            guild.builders.textDisplayLocale(
                'MUSIC.DISCONNECT.ALONE.REJOIN_TO_RESUME',
            ),
        ),
        { type: MessageOptionsBuilderType.Warning },
    );
}

async function resumeChannelSession(
    io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
    player: QuaverPlayer,
): Promise<void> {
    const guild = await QuaverGuild.wrap(player.guild);
    logger.info({
        message: `[G ${guild.id}] Resuming session`,
        label: 'Quaver',
    });
    await player.resume();
    clearTimeout(player.timeout.pause);
    player.timeout.pause = null;
    guild.sendWebUpdate('pauseUpdate', player.paused);
    guild.sendWebUpdate('pauseTimeoutUpdate', !!player.timeout.pause);
    await player.sendMessage(guild.locale('MUSIC.DISCONNECT.ALONE.RESUMING'), {
        type: MessageOptionsBuilderType.Success,
    });
}

// isOldQuaverStateUpdate is the context whether the state update belongs to Quaver
async function onChannelEmpty(
    io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
    player: QuaverPlayer,
    isOldQuaverStateUpdate: boolean,
    isGuildStayEnabled: boolean | unknown,
): Promise<void> {
    const guild = await QuaverGuild.wrap(player.guild);
    const isPlayerIdle =
        !player.queue.current || (!player.playing && !player.paused);
    // To ensure Quaver does not persist in an inactive session, disable stay feature for this guild
    if (isOldQuaverStateUpdate && isPlayerIdle && isGuildStayEnabled) {
        await guild.settings.set('stay.enabled', false);
    }
    if (isPlayerIdle && player.voice.channelId) {
        logger.info({
            message: `[G ${guild.id}] Disconnecting (alone)`,
            label: 'Quaver',
        });
        await player.sendMessage(
            guild.locale(
                isOldQuaverStateUpdate
                    ? 'MUSIC.DISCONNECT.ALONE.DISCONNECTED.MOVED'
                    : 'MUSIC.DISCONNECT.ALONE.DISCONNECTED.DEFAULT',
            ),
            { type: MessageOptionsBuilderType.Warning },
        );
        await player.disconnect();
        return;
    }
    // To ensure that Quaver does not set pauseTimeout if timeout or pauseTimeout already exists, do not pause the session
    if (
        player.timeout.standard ||
        player.timeout.pause ||
        !player.voice.channelId
    ) {
        return;
    }
    await pauseChannelSession(io, player);
}

async function onChannelJoinOrMove(
    io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
    player: QuaverPlayer,
    newState: VoiceState,
    isGuildStayEnabled: boolean | unknown,
    isOldQuaverStateUpdate: boolean,
): Promise<void> {
    const guild = await QuaverGuild.wrap(player.guild);
    const guildStayChannelId = await guild.settings.get<string>('stay.channel');
    if (isGuildStayEnabled && guildStayChannelId !== newState.channelId) {
        await guild.settings.set('stay.channel', newState.channelId);
    }
    // In this context newState#channel is always defined for join/move states, so optional chaining is unnecessary
    const hasNewChannelUsers = newState.channel.members.filter(isUser).size > 0;
    if (hasNewChannelUsers && player.timeout.pause) {
        await resumeChannelSession(io, player);
    }
    // To prevent Quaver from handling a channel that still has users or the guild's stay feature is enabled, do not handle the channel
    if (hasNewChannelUsers || isGuildStayEnabled) {
        return;
    }
    await onChannelEmpty(
        io,
        player,
        isOldQuaverStateUpdate,
        isGuildStayEnabled,
    );
}

export default new EventHandler()
    .setEvent('voiceStateUpdate')
    .setExecute(async function (oldState, newState): Promise<void> {
        const oldClient = oldState.client as QuaverClient;
        const oldClientUserId = oldClient.user.id;
        const oldUser = oldState.member.user;
        const isOldQuaverStateUpdate = oldUser.id === oldClientUserId;
        // Since we don't handle state updates for another client, do not operate
        if (!isOldQuaverStateUpdate && oldUser.bot) {
            return;
        }
        const oldChannelId = oldState.channelId;
        const newChannelId = newState.channelId;
        const isSameChannel = oldChannelId === newChannelId;
        const isNewSuppress = newState.suppress;
        const hasEnforcedStateUpdates =
            oldState.serverMute !== newState.serverMute ||
            oldState.serverDeaf !== newState.serverDeaf;
        const hasVoluntaryStateUpdates =
            oldState.streaming !== newState.streaming ||
            oldState.selfMute !== newState.selfMute ||
            oldState.selfDeaf !== newState.selfDeaf ||
            oldState.selfVideo !== newState.selfVideo;
        // To prevent Quaver from remaining suppressed when suppression is attempted mid-track, exclude suppress state update check from enforced
        const hasSameChannelStateUpdates =
            isSameChannel &&
            (oldState.suppress !== isNewSuppress ||
                hasEnforcedStateUpdates ||
                hasVoluntaryStateUpdates);
        // Since Quaver is expected to continue playback despite its own state updates, do not operate
        // Handles ignoring state updates from self-deafening or unsuppressing itself from starting tracks
        if (isOldQuaverStateUpdate && hasSameChannelStateUpdates) {
            return;
        }
        // To prevent Quaver from falling through statements doing nothing from a user's state updates, do not operate
        if (!isOldQuaverStateUpdate && hasSameChannelStateUpdates) {
            return;
        }
        const guild = await QuaverGuild.wrap(oldState.guild);
        const player = await oldClient.music.players.fetch(guild.id);
        // To prevent further operations on an uninitialized player session / player handler, do not operate
        if (!player) {
            return;
        }
        const isGuildStayEnabled =
            await guild.settings.get<boolean>('stay.enabled');
        const hasQuaverDisconnected = isOldQuaverStateUpdate && !newChannelId;
        // To ensure Quaver does not persist in an inactive session, disable stay feature for this guild
        if (hasQuaverDisconnected && isGuildStayEnabled) {
            await guild.settings.set('stay.enabled', false);
        }
        // To reset states, properly handle disconnection
        if (hasQuaverDisconnected && !player.voice.channelId) {
            logger.info({
                message: `[G ${guild.id}] Cleaning up (disconnected)`,
                label: 'Quaver',
            });
            await player.sendMessage(
                guild.locale('MUSIC.SESSION_ENDED.FORCED.DISCONNECTED'),
                { type: MessageOptionsBuilderType.Warning },
            );
            await player.disconnect(oldChannelId);
            return;
        }
        // To help Quaver remain unsuppressed in stage channels, explicitly use booleans for Quaver's state update and newState#channelId
        const isQuaverJoinOrMoveState = isOldQuaverStateUpdate && newChannelId;
        const newChannel = newState.channel;
        // In this context newState#channel can be null because of leave states, so optional chaining is necessary
        const newChannelType = newChannel?.type;
        // To keep the dashboard updated with the latest session details, emit channel events for this guild
        if (isQuaverJoinOrMoveState) {
            guild.sendWebUpdate('textChannelUpdate', player.queue.channel.name);
            guild.sendWebUpdate('channelUpdate', newChannel?.name);
        }
        // For type consistency, create an empty map for unhandled states
        const channelPermissions = isQuaverJoinOrMoveState
            ? guild.channels.cache
                  .get(newChannelId)
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
                await player.sendMessage(
                    guild.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC'),
                    { type: MessageOptionsBuilderType.Error },
                );
                await player.disconnect();
                return;
            }
            await onChannelJoinOrMove(
                guild.client.io,
                player,
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
                await player.sendMessage(
                    guild.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC'),
                    { type: MessageOptionsBuilderType.Error },
                );
                await player.disconnect();
                return;
            }
            const hasStageModerator = channelPermissions.has(
                PermissionsBitField.StageModerator,
            );
            if (!hasStageModerator && isGuildStayEnabled) {
                await guild.settings.set('stay.enabled', false);
            }
            if (!hasStageModerator) {
                await player.sendMessage(
                    guild.locale(
                        'MUSIC.SESSION_ENDED.FORCED.STAGE_NOT_MODERATOR',
                    ),
                    { type: MessageOptionsBuilderType.Warning },
                );
                await player.disconnect();
                return;
            }
            // To avoid errors from recreating a stage instance, only create one if it doesn't already exist
            if (!newChannel.stageInstance) {
                try {
                    await newChannel.createStageInstance({
                        topic: guild.locale('MISC.STAGE_TOPIC'),
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
            // To prevent a regression bug in which Quaver remains silent in stage channels, unsuppress Quaver after stage instance creation
            // Also handles unsuppressing Quaver mid-track as suppress state updates were intentionally written not to be ignored by Quaver
            await newState.setSuppressed(false);
            await onChannelJoinOrMove(
                guild.client.io,
                player,
                newState,
                isGuildStayEnabled,
                isOldQuaverStateUpdate,
            );
            return;
        }
        // Since a user joined Quaver's channel while the session was paused, resume the session
        if (
            !isOldQuaverStateUpdate &&
            newChannelId === player.voice.channelId &&
            player.timeout.pause
        ) {
            await resumeChannelSession(guild.client.io, player);
            return;
        }
        const isUserLeaveOrMoveState =
            !isOldQuaverStateUpdate && oldChannelId === player.voice.channelId;
        // Since the last user left or moved out from Quaver's channel and the guild's stay feature is disabled, handle the empty channel
        if (
            isUserLeaveOrMoveState &&
            oldState.channel?.members.filter(isUser).size < 1 &&
            !isGuildStayEnabled
        ) {
            await onChannelEmpty(
                guild.client.io,
                player,
                isOldQuaverStateUpdate,
                isGuildStayEnabled,
            );
        }
    });
