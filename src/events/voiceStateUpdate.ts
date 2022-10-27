import type { QuaverClient, QuaverPlayer } from '#src/lib/util/common.d.js';
import { data, logger } from '#src/lib/util/common.js';
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
        const player = client.music.players.get(guild.id) as QuaverPlayer;
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
                    message: `[G ${player.guildId}] Cleaning up`,
                    label: 'Quaver',
                });
                player.channelId = null;
                if (
                    await data.guild.get(
                        player.guildId,
                        'settings.stay.enabled',
                    )
                ) {
                    await data.guild.set(
                        player.guildId,
                        'settings.stay.enabled',
                        false,
                    );
                }
                await player.handler.locale(
                    'MUSIC.SESSION_ENDED.FORCED.DISCONNECTED',
                    { type: 'warning' },
                );
                return player.handler.disconnect(oldState.channelId);
            }
            /** Checks for when Quaver joins or moves */
            if (settings.features.web.enabled) {
                io.to(`guild:${player.guildId}`).emit(
                    'textChannelUpdate',
                    player.queue.channel.name,
                );
                io.to(`guild:${player.guildId}`).emit(
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
                        { type: 'error' },
                    );
                    return player.handler.disconnect();
                }
                if (
                    (await data.guild.get(
                        player.guildId,
                        'settings.stay.enabled',
                    )) &&
                    (await data.guild.get(
                        player.guildId,
                        'settings.stay.channel',
                    )) !== newState.channelId
                ) {
                    await data.guild.set(
                        player.guildId,
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
                        { type: 'error' },
                    );
                    return player.handler.disconnect();
                }
                if (!permissions.has(PermissionsBitField.StageModerator)) {
                    if (
                        await data.guild.get(
                            player.guildId,
                            'settings.stay.enabled',
                        )
                    ) {
                        await data.guild.set(
                            player.guildId,
                            'settings.stay.enabled',
                            false,
                        );
                    }
                    await player.handler.locale(
                        'MUSIC.SESSION_ENDED.FORCED.STAGE_NOT_MODERATOR',
                        { type: 'warning' },
                    );
                    return player.handler.disconnect();
                }
                await newState.setSuppressed(false);
                if (!newState.channel.stageInstance) {
                    try {
                        await newState.channel.createStageInstance({
                            topic: await getGuildLocaleString(
                                player.guildId,
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
                if (
                    (await data.guild.get(
                        player.guildId,
                        'settings.stay.enabled',
                    )) &&
                    (await data.guild.get(
                        player.guildId,
                        'settings.stay.channel',
                    )) !== newState.channelId
                ) {
                    await data.guild.set(
                        player.guildId,
                        'settings.stay.channel',
                        newState.channelId,
                    );
                }
            }
            // Moved to a new channel that has no humans and 24/7 is disabled
            if (
                newState.channel.members.filter((m): boolean => !m.user.bot)
                    .size < 1 &&
                !(await data.guild.get(player.guildId, 'settings.stay.enabled'))
            ) {
                // Avoid pauseTimeout if 24/7 is enabled
                if (
                    await data.guild.get(
                        player.guildId,
                        'settings.stay.enabled',
                    )
                ) {
                    return;
                }
                // Nothing is playing so we'll leave
                if (
                    !player.queue.current ||
                    (!player.playing && !player.paused)
                ) {
                    if (
                        await data.guild.get(
                            player.guildId,
                            'settings.stay.enabled',
                        )
                    ) {
                        await data.guild.set(
                            player.guildId,
                            'settings.stay.enabled',
                            false,
                        );
                    }
                    logger.info({
                        message: `[G ${player.guildId}] Disconnecting (alone)`,
                        label: 'Quaver',
                    });
                    await player.handler.locale(
                        'MUSIC.DISCONNECT.ALONE.DISCONNECTED.MOVED',
                        { type: 'warning' },
                    );
                    return player.handler.disconnect();
                }
                // Ensure that Quaver does not set pauseTimeout if timeout already exists
                // Ensure that Quaver does not set a new pauseTimeout if pauseTimeout already exists
                if (player.timeout || player.pauseTimeout) return;
                // Quaver was playing something - set pauseTimeout
                await player.pause();
                if (settings.features.web.enabled) {
                    io.to(`guild:${player.guildId}`).emit(
                        'pauseUpdate',
                        player.paused,
                    );
                }
                logger.info({
                    message: `[G ${player.guildId}] Setting pause timeout`,
                    label: 'Quaver',
                });
                // Before setting a new pauseTimeout, clear the pauseTimeout first as a failsafe
                clearTimeout(player.pauseTimeout);
                player.pauseTimeout = setTimeout(
                    (p): void => {
                        logger.info({
                            message: `[G ${p.guildId}] Disconnecting (inactivity)`,
                            label: 'Quaver',
                        });
                        p.handler.locale(
                            'MUSIC.DISCONNECT.INACTIVITY.DISCONNECTED',
                            { type: 'warning' },
                        );
                        p.handler.disconnect();
                    },
                    5 * 60 * 1000,
                    player,
                );
                player.timeoutEnd = Date.now() + 5 * 60 * 1000;
                if (settings.features.web.enabled) {
                    io.to(`guild:${player.guildId}`).emit(
                        'pauseTimeoutUpdate',
                        player.timeoutEnd,
                    );
                }
                await player.handler.send(
                    new EmbedBuilder()
                        .setDescription(
                            `${await getGuildLocaleString(
                                player.guildId,
                                'MUSIC.DISCONNECT.ALONE.WARNING',
                            )} ${await getGuildLocaleString(
                                player.guildId,
                                'MUSIC.DISCONNECT.INACTIVITY.WARNING',
                                (
                                    Math.floor(Date.now() / 1000) +
                                    5 * 60
                                ).toString(),
                            )}`,
                        )
                        .setFooter({
                            text: await getGuildLocaleString(
                                player.guildId,
                                'MUSIC.DISCONNECT.ALONE.REJOIN_TO_RESUME',
                            ),
                        }),
                    { type: 'warning' },
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
                    message: `[G ${player.guildId}] Resuming session`,
                    label: 'Quaver',
                });
                await player.resume();
                clearTimeout(player.pauseTimeout);
                delete player.pauseTimeout;
                if (settings.features.web.enabled) {
                    io.to(`guild:${player.guildId}`).emit(
                        'pauseUpdate',
                        player.paused,
                    );
                    io.to(`guild:${player.guildId}`).emit(
                        'pauseTimeoutUpdate',
                        !!player.pauseTimeout,
                    );
                }
                await player.handler.locale('MUSIC.DISCONNECT.ALONE.RESUMING', {
                    type: 'success',
                });
                return;
            }
        }
        // Other bots' voice state changed
        if (oldState.member.user.bot) return;
        // User voiceStateUpdate
        /** Checks for when a user joins or moves */
        // User joined or moved to Quaver's channel, and pauseTimeout is set
        if (newState.channelId === player?.channelId && player?.pauseTimeout) {
            logger.info({
                message: `[G ${player.guildId}] Resuming session`,
                label: 'Quaver',
            });
            await player.resume();
            if (settings.features.web.enabled) {
                io.to(`guild:${player.guildId}`).emit(
                    'pauseUpdate',
                    player.paused,
                );
            }
            if (player.pauseTimeout) {
                clearTimeout(player.pauseTimeout);
                delete player.pauseTimeout;
                if (settings.features.web.enabled) {
                    io.to(`guild:${player.guildId}`).emit(
                        'pauseTimeoutUpdate',
                        !!player.pauseTimeout,
                    );
                }
            }
            await player.handler.locale('MUSIC.DISCONNECT.ALONE.RESUMING', {
                type: 'success',
            });
            return;
        }
        // User not in Quaver's channel
        if (oldState.channelId !== player?.channelId) return;
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
                message: `[G ${player.guildId}] Disconnecting (alone)`,
                label: 'Quaver',
            });
            await player.handler.locale(
                'MUSIC.DISCONNECT.ALONE.DISCONNECTED.DEFAULT',
                { type: 'warning' },
            );
            return player.handler.disconnect();
        }
        // Ensure that Quaver does not set pauseTimeout if timeout already exists
        // Ensure that Quaver does not set pauseTimeout after a stage ends
        if (player.timeout || !player.channelId) return;
        const voiceChannel = oldState.client.guilds.cache
            .get(player.guildId)
            .channels.cache.get(player.channelId);
        if (
            voiceChannel.type === ChannelType.GuildStageVoice &&
            !voiceChannel.stageInstance
        ) {
            return;
        }
        // Quaver was playing something - set pauseTimeout
        await player.pause();
        if (settings.features.web.enabled) {
            io.to(`guild:${player.guildId}`).emit('pauseUpdate', player.paused);
        }
        logger.info({
            message: `[G ${player.guildId}] Setting pause timeout`,
            label: 'Quaver',
        });
        // Before setting a new pauseTimeout, clear the pauseTimeout first as a failsafe
        clearTimeout(player.pauseTimeout);
        player.pauseTimeout = setTimeout(
            (p): void => {
                logger.info({
                    message: `[G ${p.guildId}] Disconnecting (inactivity)`,
                    label: 'Quaver',
                });
                p.handler.locale('MUSIC.DISCONNECT.INACTIVITY.DISCONNECTED', {
                    type: 'warning',
                });
                p.handler.disconnect();
            },
            5 * 60 * 1000,
            player,
        );
        player.timeoutEnd = Date.now() + 5 * 60 * 1000;
        if (settings.features.web.enabled) {
            io.to(`guild:${player.guildId}`).emit(
                'pauseTimeoutUpdate',
                player.timeoutEnd,
            );
        }
        await player.handler.send(
            new EmbedBuilder()
                .setDescription(
                    `${await getGuildLocaleString(
                        player.guildId,
                        'MUSIC.DISCONNECT.ALONE.WARNING',
                    )} ${await getGuildLocaleString(
                        player.guildId,
                        'MUSIC.DISCONNECT.INACTIVITY.WARNING',
                        (Math.floor(Date.now() / 1000) + 5 * 60).toString(),
                    )}`,
                )
                .setFooter({
                    text: await getGuildLocaleString(
                        player.guildId,
                        'MUSIC.DISCONNECT.ALONE.REJOIN_TO_RESUME',
                    ),
                }),
            { type: 'warning' },
        );
    },
};
