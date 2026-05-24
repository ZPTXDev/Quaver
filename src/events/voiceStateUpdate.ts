import { MessageOptionsBuilderType, type QuaverClient } from '#src/lib';
import { EventHandler } from '#src/lib/builders';
import { type Initialized, QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import type { QuaverPlayer } from '#src/lib/music';
import {
    ChannelType,
    ContainerBuilder,
    type Guild,
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
    logger.info(`[G ${guild.id}] Setting pause timeout`);
    // As a failsafe, clear the pauseTimeout first before setting a new pauseTimeout
    clearTimeout(player.timeout.pause);
    player.timeout.pause = null;
    player.timeout.pause = setTimeout(
        (p, g): void => {
            logger.info(`[G ${g.id}] Disconnecting (inactivity)`);
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
    logger.info(`[G ${guild.id}] Resuming session`);
    await player.resume();
    clearTimeout(player.timeout.pause);
    player.timeout.pause = null;
    player.timeout.pausedAlone = false;
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
    isGuildStayEnabled: boolean | undefined,
): Promise<void> {
    const guild = await QuaverGuild.wrap(player.guild);
    const isPlayerIdle =
        !player.queue.current || (!player.playing && !player.paused);
    // To ensure Quaver does not persist in an inactive session, disable stay feature for this guild
    if (isOldQuaverStateUpdate && isPlayerIdle && isGuildStayEnabled) {
        await guild.settings.set('stay.enabled', false);
    }
    if (isPlayerIdle && player.voice.channelId) {
        if (isGuildStayEnabled) {
            return;
        }
        logger.info(`[G ${guild.id}] Disconnecting (alone)`);
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
        player.timeout.pausedAlone ||
        !player.voice.channelId
    ) {
        return;
    }
    if (isGuildStayEnabled) {
        if (player.paused) {
            return;
        }
        await player.pause();
        guild.sendWebUpdate('pauseUpdate', player.paused);
        player.timeout.pausedAlone = true;
        await player.sendMessage(
            new ContainerBuilder().addTextDisplayComponents(
                guild.builders.textDisplayLocale(
                    'MUSIC.DISCONNECT.ALONE.WARNING',
                ),
                guild.builders.textDisplayLocale(
                    'MUSIC.DISCONNECT.ALONE.REJOIN_TO_RESUME',
                ),
            ),
            { type: MessageOptionsBuilderType.Warning },
        );
        return;
    }
    await pauseChannelSession(io, player);
}

async function onChannelJoinOrMove(
    io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>,
    player: QuaverPlayer,
    newState: VoiceState,
    isGuildStayEnabled: boolean | undefined,
    isOldQuaverStateUpdate: boolean,
): Promise<void> {
    const guild = await QuaverGuild.wrap(player.guild);
    const guildStayChannelId = await guild.settings.get<string>('stay.channel');
    if (isGuildStayEnabled && guildStayChannelId !== newState.channelId) {
        await guild.settings.set('stay.channel', newState.channelId);
    }
    // In this context newState#channel is always defined for join/move states, so optional chaining is unnecessary
    const hasNewChannelUsers = newState.channel.members.filter(isUser).size > 0;
    if (
        hasNewChannelUsers &&
        (player.timeout.pause || player.timeout.pausedAlone)
    ) {
        await resumeChannelSession(io, player);
    }
    // To prevent Quaver from handling a channel that still has users or the guild's stay feature is enabled, do not handle the channel
    const pauseAlone =
        (await guild.settings.get<boolean>('pausealone247')) ?? false;
    if (hasNewChannelUsers || (isGuildStayEnabled && !pauseAlone)) {
        return;
    }
    await onChannelEmpty(
        io,
        player,
        isOldQuaverStateUpdate,
        isGuildStayEnabled,
    );
}

async function handleQuaverDisconnection(
    guild: QuaverGuild<Initialized> & Guild,
    player: QuaverPlayer,
    oldChannelId: string | null,
    isGuildStayEnabled: boolean | undefined,
): Promise<void> {
    // To ensure Quaver does not persist in an inactive session, disable stay feature for this guild
    if (isGuildStayEnabled) {
        await guild.settings.set('stay.enabled', false);
    }
    // To reset states, properly handle disconnection
    if (!player.voice.channelId) {
        logger.info(`[G ${guild.id}] Cleaning up (disconnected)`);
        await player.sendMessage(
            guild.locale('MUSIC.SESSION_ENDED.FORCED.DISCONNECTED'),
            { type: MessageOptionsBuilderType.Warning },
        );
        await player.disconnect(oldChannelId ?? undefined);
    }
}

async function handleQuaverJoinOrMove(
    guild: QuaverGuild<Initialized> & Guild,
    player: QuaverPlayer,
    newState: VoiceState,
    isGuildStayEnabled: boolean | undefined,
    isOldQuaverStateUpdate: boolean,
    oldClientUserId: string,
): Promise<void> {
    const newChannelId = newState.channelId;
    if (!newChannelId) return;
    const newChannel = newState.channel;
    const newChannelType = newChannel?.type;

    // To keep the dashboard updated with the latest session details, emit channel events for this guild
    guild.sendWebUpdate('textChannelUpdate', player.queue.channel?.name);
    guild.sendWebUpdate('channelUpdate', newChannel?.name);

    // For type consistency, create an empty map for unhandled states
    const channelPermissions = guild.channels.cache
        .get(newChannelId)
        ?.permissionsFor(oldClientUserId);
    if (!channelPermissions) {
        await player.disconnect();
        return;
    }

    const hasBasicChannelPermissions = channelPermissions.has(
        new PermissionsBitField([
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak,
        ]),
    );

    if (newChannelType === ChannelType.GuildVoice) {
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

    if (newChannelType === ChannelType.GuildStageVoice) {
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
                guild.locale('MUSIC.SESSION_ENDED.FORCED.STAGE_NOT_MODERATOR'),
                { type: MessageOptionsBuilderType.Warning },
            );
            await player.disconnect();
            return;
        }
        if (newState.suppress) {
            // To avoid errors from recreating a stage instance, only create one if it doesn't already exist
            if (newChannel && !newChannel.stageInstance) {
                try {
                    await newChannel.createStageInstance({
                        topic: guild.locale('MISC.STAGE_TOPIC'),
                        privacyLevel: StageInstancePrivacyLevel.GuildOnly,
                    });
                } catch (error) {
                    if (error instanceof Error) {
                        logger.error(`${error.message}\n${error.stack}`);
                    }
                }
            }
            // To prevent a regression bug in which Quaver remains silent in stage channels, unsuppress Quaver after stage instance creation
            // Also handles unsuppressing Quaver mid-track as suppress state updates were intentionally written not to be ignored by Quaver
            await newState.setSuppressed(false);
        }
        await onChannelJoinOrMove(
            guild.client.io,
            player,
            newState,
            isGuildStayEnabled,
            isOldQuaverStateUpdate,
        );
    }
}

async function handleUserVoiceStateUpdate(
    oldState: VoiceState,
    newState: VoiceState,
    guild: QuaverGuild<Initialized> & Guild,
    player: QuaverPlayer,
    isGuildStayEnabled: boolean | undefined,
    isOldQuaverStateUpdate: boolean,
): Promise<void> {
    const newChannelId = newState.channelId;
    const oldChannelId = oldState.channelId;

    // Since a user joined Quaver's channel while the session was paused, resume the session
    if (
        newChannelId === player.voice.channelId &&
        (player.timeout.pause || player.timeout.pausedAlone)
    ) {
        await resumeChannelSession(guild.client.io, player);
        return;
    }

    const isUserLeaveOrMoveState = oldChannelId === player.voice.channelId;
    // Since the last user left or moved out from Quaver's channel, handle the empty channel
    if (
        isUserLeaveOrMoveState &&
        oldState.channel?.members.filter(isUser).size < 1
    ) {
        const pauseAlone =
            (await guild.settings.get<boolean>('pausealone247')) ?? false;
        if (!isGuildStayEnabled || pauseAlone) {
            await onChannelEmpty(
                guild.client.io,
                player,
                isOldQuaverStateUpdate,
                isGuildStayEnabled,
            );
        }
    }
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
        // To prevent Quaver from falling through statements doing nothing from a user's state updates, do not operate
        if (hasSameChannelStateUpdates) {
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

        if (hasQuaverDisconnected) {
            await handleQuaverDisconnection(
                guild,
                player,
                oldChannelId,
                isGuildStayEnabled,
            );
            return;
        }

        const isQuaverJoinOrMoveState = isOldQuaverStateUpdate && newChannelId;
        if (isQuaverJoinOrMoveState) {
            await handleQuaverJoinOrMove(
                guild,
                player,
                newState,
                isGuildStayEnabled,
                isOldQuaverStateUpdate,
                oldClientUserId,
            );
            return;
        }

        await handleUserVoiceStateUpdate(
            oldState,
            newState,
            guild,
            player,
            isGuildStayEnabled,
            isOldQuaverStateUpdate,
        );
    });
