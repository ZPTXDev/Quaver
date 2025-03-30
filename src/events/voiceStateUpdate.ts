import type { QuaverClient, QuaverPlayer } from '#src/lib/util/common.d.js';
import {
    MessageOptionsBuilderType,
    data,
    logger,
} from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString } from '#src/lib/util/util.js';
import type { VoiceState } from 'discord.js';
import {
    ChannelType,
    EmbedBuilder,
    PermissionsBitField,
    StageInstancePrivacyLevel,
} from 'discord.js';

export default {
    name: 'voiceStateUpdate',
    once: false,
    async execute(oldState: VoiceState, newState: VoiceState): Promise<void> {
        const { io } = await import('#src/main.js');
        const guild = oldState.guild;
        const client = oldState.client as QuaverClient;
        const player = (await client.music.players.fetch(
            guild.id,
        )) as QuaverPlayer;
        if (!player) return;
        // Quaver voiceStateUpdate
        if (oldState.member.user.id === oldState.client.user.id) {
            // Quaver didn't leave the channel, but their voice state changed
            if (
                (oldState.suppress !== newState.suppress ||
                    oldState.serverMute !== newState.serverMute ||
                    oldState.serverDeaf !== newState.serverDeaf) &&
                oldState.channelId === newState.channelId
            ) {
                return;
            }
            /** Checks for when Quaver leaves */
            // Disconnected
            if (!newState.channelId) {
                logger.info({
                    message: `[G ${player.id}] Cleaning up (disconnected)`,
                    label: 'Quaver',
                });
                player.voice.channelId = null;
                if (await data.guild.get(player.id, 'settings.stay.enabled')) {
                    await data.guild.set(
                        player.id,
                        'settings.stay.enabled',
                        false,
                    );
                }
                await player.handler.locale(
                    'MUSIC.SESSION_ENDED.FORCED.DISCONNECTED',
                    { type: MessageOptionsBuilderType.Warning },
                );
                await player.handler.disconnect(oldState.channelId);
                return;
            }
            /** Checks for when Quaver joins or moves */
            if (settings.features.web.enabled) {
                io.to(`guild:${player.id}`).emit(
                    'textChannelUpdate',
                    player.queue.channel.name,
                );
                io.to(`guild:${player.id}`).emit(
                    'channelUpdate',
                    newState.channel?.name,
                );
            }
            // Channel is a voice channel
            if (newState.channel.type === ChannelType.GuildVoice) {
                // Check for connect, speak permission for voice channel
                const permissions = oldState.client.guilds.cache
                    .get(guild.id)
                    .channels.cache.get(newState.channelId)
                    .permissionsFor(oldState.client.user.id);
                if (
                    !permissions.has(
                        new PermissionsBitField([
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.Connect,
                            PermissionsBitField.Flags.Speak,
                        ]),
                    )
                ) {
                    await player.handler.locale(
                        'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC',
                        { type: MessageOptionsBuilderType.Error },
                    );
                    await player.handler.disconnect();
                    return;
                }
                if (
                    (await data.guild.get(
                        player.id,
                        'settings.stay.enabled',
                    )) &&
                    (await data.guild.get(
                        player.id,
                        'settings.stay.channel',
                    )) !== newState.channelId
                ) {
                    await data.guild.set(
                        player.id,
                        'settings.stay.channel',
                        newState.channelId,
                    );
                }
            }
            // Channel is a stage channel, and Quaver is suppressed
            // This also handles suppressing Quaver mid-track
            if (
                newState.channel.type === ChannelType.GuildStageVoice &&
                newState.suppress
            ) {
                const permissions = oldState.client.guilds.cache
                    .get(guild.id)
                    .channels.cache.get(newState.channelId)
                    .permissionsFor(oldState.client.user.id);
                // Check for connect, speak permission for stage channel
                if (
                    !permissions.has(
                        new PermissionsBitField([
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.Connect,
                            PermissionsBitField.Flags.Speak,
                        ]),
                    )
                ) {
                    await player.handler.locale(
                        'DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC',
                        { type: MessageOptionsBuilderType.Error },
                    );
                    await player.handler.disconnect();
                    return;
                }
                if (!permissions.has(PermissionsBitField.StageModerator)) {
                    if (
                        await data.guild.get(player.id, 'settings.stay.enabled')
                    ) {
                        await data.guild.set(
                            player.id,
                            'settings.stay.enabled',
                            false,
                        );
                    }
                    await player.handler.locale(
                        'MUSIC.SESSION_ENDED.FORCED.STAGE_NOT_MODERATOR',
                        { type: MessageOptionsBuilderType.Warning },
                    );
                    await player.handler.disconnect();
                    return;
                }
                if (!newState.channel.stageInstance) {
                    try {
                        await newState.channel.createStageInstance({
                            topic: await getGuildLocaleString(
                                player.id,
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
                await newState.setSuppressed(false);
                if (
                    (await data.guild.get(
                        player.id,
                        'settings.stay.enabled',
                    )) &&
                    (await data.guild.get(
                        player.id,
                        'settings.stay.channel',
                    )) !== newState.channelId
                ) {
                    await data.guild.set(
                        player.id,
                        'settings.stay.channel',
                        newState.channelId,
                    );
                }
            }
            // Moved to a new channel that has no humans and 24/7 is disabled
            if (
                newState.channel.members.filter((m): boolean => !m.user.bot)
                    .size < 1 &&
                !(await data.guild.get(player.id, 'settings.stay.enabled'))
            ) {
                // Avoid pauseTimeout if 24/7 is enabled
                if (await data.guild.get(player.id, 'settings.stay.enabled')) {
                    return;
                }
                // Nothing is playing so we'll leave
                if (
                    !player.queue.current ||
                    (!player.playing && !player.paused)
                ) {
                    if (
                        await data.guild.get(player.id, 'settings.stay.enabled')
                    ) {
                        await data.guild.set(
                            player.id,
                            'settings.stay.enabled',
                            false,
                        );
                    }
                    logger.info({
                        message: `[G ${player.id}] Disconnecting (alone)`,
                        label: 'Quaver',
                    });
                    await player.handler.locale(
                        'MUSIC.DISCONNECT.ALONE.DISCONNECTED.MOVED',
                        { type: MessageOptionsBuilderType.Warning },
                    );
                    await player.handler.disconnect();
                    return;
                }
                // Ensure that Quaver does not set pauseTimeout if timeout already exists
                // Ensure that Quaver does not set a new pauseTimeout if pauseTimeout already exists
                if (player.timeout || player.pauseTimeout) return;
                // Quaver was playing something - set pauseTimeout
                await player.pause();
                if (settings.features.web.enabled) {
                    io.to(`guild:${player.id}`).emit(
                        'pauseUpdate',
                        player.paused,
                    );
                }
                logger.info({
                    message: `[G ${player.id}] Setting pause timeout`,
                    label: 'Quaver',
                });
                // Before setting a new pauseTimeout, clear the pauseTimeout first as a failsafe
                clearTimeout(player.pauseTimeout);
                player.pauseTimeout = setTimeout(
                    (p): void => {
                        logger.info({
                            message: `[G ${p.id}] Disconnecting (inactivity)`,
                            label: 'Quaver',
                        });
                        p.handler.locale(
                            'MUSIC.DISCONNECT.INACTIVITY.DISCONNECTED',
                            { type: MessageOptionsBuilderType.Warning },
                        );
                        p.handler.disconnect();
                    },
                    5 * 60 * 1000,
                    player,
                );
                player.timeoutEnd = Date.now() + 5 * 60 * 1000;
                if (settings.features.web.enabled) {
                    io.to(`guild:${player.id}`).emit(
                        'pauseTimeoutUpdate',
                        player.timeoutEnd,
                    );
                }
                await player.handler.send(
                    new EmbedBuilder()
                        .setDescription(
                            `${await getGuildLocaleString(
                                player.id,
                                'MUSIC.DISCONNECT.ALONE.WARNING',
                            )} ${await getGuildLocaleString(
                                player.id,
                                'MUSIC.DISCONNECT.INACTIVITY.WARNING',
                                (
                                    Math.floor(Date.now() / 1000) +
                                    5 * 60
                                ).toString(),
                            )}`,
                        )
                        .setFooter({
                            text: await getGuildLocaleString(
                                player.id,
                                'MUSIC.DISCONNECT.ALONE.REJOIN_TO_RESUME',
                            ),
                        }),
                    { type: MessageOptionsBuilderType.Warning },
                );
                return;
            }
            // Moved to a new channel that has humans and pauseTimeout is set
            if (
                newState.channel.members.filter((m): boolean => !m.user.bot)
                    .size >= 1 &&
                player.pauseTimeout
            ) {
                logger.info({
                    message: `[G ${player.id}] Resuming session`,
                    label: 'Quaver',
                });
                await player.resume();
                clearTimeout(player.pauseTimeout);
                delete player.pauseTimeout;
                if (settings.features.web.enabled) {
                    io.to(`guild:${player.id}`).emit(
                        'pauseUpdate',
                        player.paused,
                    );
                    io.to(`guild:${player.id}`).emit(
                        'pauseTimeoutUpdate',
                        !!player.pauseTimeout,
                    );
                }
                await player.handler.locale('MUSIC.DISCONNECT.ALONE.RESUMING', {
                    type: MessageOptionsBuilderType.Success,
                });
                return;
            }
        }
        // Other bots' voice state changed
        if (oldState.member.user.bot) return;
        // User voiceStateUpdate
        /** Checks for when a user joins or moves */
        // User joined or moved to Quaver's channel, and pauseTimeout is set
        if (
            newState.channelId === player?.voice.channelId &&
            player?.pauseTimeout
        ) {
            logger.info({
                message: `[G ${player.id}] Resuming session`,
                label: 'Quaver',
            });
            await player.resume();
            if (settings.features.web.enabled) {
                io.to(`guild:${player.id}`).emit('pauseUpdate', player.paused);
            }
            if (player.pauseTimeout) {
                clearTimeout(player.pauseTimeout);
                delete player.pauseTimeout;
                if (settings.features.web.enabled) {
                    io.to(`guild:${player.id}`).emit(
                        'pauseTimeoutUpdate',
                        !!player.pauseTimeout,
                    );
                }
            }
            await player.handler.locale('MUSIC.DISCONNECT.ALONE.RESUMING', {
                type: MessageOptionsBuilderType.Success,
            });
            return;
        }
        // User not in Quaver's channel
        if (oldState.channelId !== player?.voice.channelId) return;
        // User didn't leave the channel, but their voice state changed
        if (newState.channelId === oldState.channelId) return;
        /** Checks for when a user leaves */
        // Avoid pauseTimeout if 24/7 is enabled
        if (await data.guild.get(guild.id, 'settings.stay.enabled')) return;
        // Channel still has humans
        if (
            oldState.channel?.members.filter((m): boolean => !m.user.bot)
                .size >= 1
        ) {
            return;
        }
        // Nothing is playing so we'll leave
        if (!player.queue.current || (!player.playing && !player.paused)) {
            logger.info({
                message: `[G ${player.id}] Disconnecting (alone)`,
                label: 'Quaver',
            });
            await player.handler.locale(
                'MUSIC.DISCONNECT.ALONE.DISCONNECTED.DEFAULT',
                { type: MessageOptionsBuilderType.Warning },
            );
            await player.handler.disconnect();
            return;
        }
        // Ensure that Quaver does not set pauseTimeout if timeout already exists
        // Ensure that Quaver does not set pauseTimeout after a stage ends
        if (player.timeout || !player.voice.channelId) return;
        const voiceChannel = oldState.client.guilds.cache
            .get(player.id)
            .channels.cache.get(player.voice.channelId);
        if (
            voiceChannel.type === ChannelType.GuildStageVoice &&
            !voiceChannel.stageInstance
        ) {
            return;
        }
        // Quaver was playing something - set pauseTimeout
        await player.pause();
        if (settings.features.web.enabled) {
            io.to(`guild:${player.id}`).emit('pauseUpdate', player.paused);
        }
        logger.info({
            message: `[G ${player.id}] Setting pause timeout`,
            label: 'Quaver',
        });
        // Before setting a new pauseTimeout, clear the pauseTimeout first as a failsafe
        clearTimeout(player.pauseTimeout);
        player.pauseTimeout = setTimeout(
            (p): void => {
                logger.info({
                    message: `[G ${p.id}] Disconnecting (inactivity)`,
                    label: 'Quaver',
                });
                p.handler.locale('MUSIC.DISCONNECT.INACTIVITY.DISCONNECTED', {
                    type: MessageOptionsBuilderType.Warning,
                });
                p.handler.disconnect();
            },
            5 * 60 * 1000,
            player,
        );
        player.timeoutEnd = Date.now() + 5 * 60 * 1000;
        if (settings.features.web.enabled) {
            io.to(`guild:${player.id}`).emit(
                'pauseTimeoutUpdate',
                player.timeoutEnd,
            );
        }
        await player.handler.send(
            new EmbedBuilder()
                .setDescription(
                    `${await getGuildLocaleString(
                        player.id,
                        'MUSIC.DISCONNECT.ALONE.WARNING',
                    )} ${await getGuildLocaleString(
                        player.id,
                        'MUSIC.DISCONNECT.INACTIVITY.WARNING',
                        (Math.floor(Date.now() / 1000) + 5 * 60).toString(),
                    )}`,
                )
                .setFooter({
                    text: await getGuildLocaleString(
                        player.id,
                        'MUSIC.DISCONNECT.ALONE.REJOIN_TO_RESUME',
                    ),
                }),
            { type: MessageOptionsBuilderType.Warning },
        );
    },
};
