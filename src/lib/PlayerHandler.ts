import type {
    MessageOptionsBuilderInputs,
    MessageOptionsBuilderOptions,
    QuaverChannels,
    QuaverClient,
    QuaverPlayer,
    QuaverSong,
} from '#src/lib/util/common.d.js';
import {
    data,
    logger,
    MessageOptionsBuilderType,
} from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import {
    buildMessageOptions,
    getGuildFeatureWhitelisted,
    getGuildLocaleString,
    sortQueue,
    WhitelistStatus,
} from '#src/lib/util/util.js';
import type { LoopType } from '@lavaclient/queue';
import type { Message, Snowflake } from 'discord.js';
import { ChannelType, PermissionsBitField } from 'discord.js';

export enum PlayerResponse {
    FeatureDisabled,
    FeatureNotWhitelisted,
    FeatureConflict,
    QueueChannelMissing,
    InsufficientPermissions,
    QueueInsufficientTracks,
    InputOutOfRange,
    InputInvalid,
    PlayerStateUnchanged,
    PlayerIdle,
    PlayerIsStream,
    Success,
}

/** Class for handling Lavaclient's Player. */
export default class PlayerHandler {
    client: QuaverClient;
    player: QuaverPlayer;

    /**
     * Create an instance of PlayerHandler.
     * @param client - The discord.js Client.
     * @param player - The Lavaclient Player.
     */
    constructor(client: QuaverClient, player: QuaverPlayer) {
        this.client = client;
        this.player = player;
    }

    /**
     * Sends a message to the bound text channel.
     * @param inputData - The data to be used. Can be a string, EmbedBuilder, or an array of either.
     * @param options - Extra data, such as type or components, or files.
     * @returns The message that was sent.
     */
    async send(
        inputData: MessageOptionsBuilderInputs,
        {
            type = MessageOptionsBuilderType.Neutral,
            components = null,
            files = null,
        }: MessageOptionsBuilderOptions = {},
    ): Promise<Message | undefined> {
        const sendMsgOpts = buildMessageOptions(inputData, {
            type,
            components,
            files,
        });
        const channel = this.player.queue.channel;
        if (
            !channel
                ?.permissionsFor(this.client.user.id)
                ?.has(
                    new PermissionsBitField([
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                    ]),
                )
        ) {
            return undefined;
        }
        if (
            this.client.guilds.cache
                .get(this.player.guildId)
                .members.me.isCommunicationDisabled()
        ) {
            return undefined;
        }
        try {
            return await channel.send(sendMsgOpts);
        } catch (error) {
            if (error instanceof Error) {
                logger.error({
                    message: `${error.message}\n${error.stack}`,
                    label: 'Quaver',
                });
            }
            return undefined;
        }
    }

    /**
     * Sends a localized message to the bound text channel.
     * @param stringPath - The code of the locale string to be used.
     * @param options - Extra data, such as type or components.
     * @returns The message that was sent.
     */
    async locale(
        stringPath: string,
        {
            vars = [],
            type = MessageOptionsBuilderType.Neutral,
            components = null,
            files = null,
        }: MessageOptionsBuilderOptions & { vars?: string[] } = {},
    ): Promise<Message | undefined> {
        const guildLocaleString = await getGuildLocaleString(
            this.player.guildId,
            stringPath,
            ...vars,
        );
        return this.send(guildLocaleString, { type, components, files });
    }

    /**
     * Toggle 24/7 mode.
     * @param enabled - Whether or not the feature is enabled.
     * @returns Whether or not the feature was enabled.
     */
    async stay(enabled: boolean): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        if (!settings.features.stay.enabled) {
            return PlayerResponse.FeatureDisabled;
        }
        if (settings.features.stay.whitelist) {
            const whitelisted = await getGuildFeatureWhitelisted(
                this.player.guildId,
                'stay',
            );
            if (
                whitelisted === WhitelistStatus.NotWhitelisted ||
                whitelisted === WhitelistStatus.Expired
            ) {
                return PlayerResponse.FeatureNotWhitelisted;
            }
        }
        if (!this.player?.queue?.channel?.id) {
            return PlayerResponse.QueueChannelMissing;
        }
        await data.guild.set(
            this.player.guildId,
            'settings.stay.enabled',
            enabled,
        );
        if (enabled) {
            await data.guild.set(
                this.player.guildId,
                'settings.stay.channel',
                this.player.channelId,
            );
            await data.guild.set(
                this.player.guildId,
                'settings.stay.text',
                this.player.queue.channel.id,
            );
        }
        if (this.player.timeout) {
            clearTimeout(this.player.timeout);
            delete this.player.timeout;
            if (settings.features.web.enabled) {
                io.to(`guild:${this.player.guildId}`).emit(
                    'timeoutUpdate',
                    !!this.player.timeout,
                );
            }
        }
        return PlayerResponse.Success;
    }

    /**
     * Toggle bass boost mode.
     * @param enabled - Whether or not the feature is enabled.
     * @returns Whether or not the feature was enabled.
     */
    async bassboost(enabled: boolean): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        let eqValues: number[] = new Array(15).fill(0);
        if (enabled) {
            eqValues = [
                0.2,
                0.15,
                0.1,
                0.05,
                0.0,
                ...new Array(10).fill(-0.05),
            ];
        }
        await this.player.setEqualizer(...eqValues);
        this.player.bassboost = enabled;
        if (settings.features.web.enabled) {
            io.to(`guild:${this.player.guildId}`).emit('filterUpdate', {
                bassboost: this.player.bassboost,
                nightcore: this.player.nightcore,
            });
        }
        return PlayerResponse.Success;
    }

    /**
     * Bind the player to a text channel.
     * @param channel - The channel to bind to.
     * @returns Whether or not the player was bound.
     */
    async bind(channel: QuaverChannels): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        if (
            !channel
                .permissionsFor(this.client.user.id)
                .has(
                    new PermissionsBitField([
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                    ]),
                )
        ) {
            return PlayerResponse.InsufficientPermissions;
        }
        this.player.queue.channel = channel;
        if (settings.features.web.enabled) {
            io.to(`guild:${this.player.guildId}`).emit(
                'textChannelUpdate',
                channel.name,
            );
        }
        if (
            await data.guild.get(this.player.guildId, 'settings.stay.enabled')
        ) {
            await data.guild.set(
                this.player.guildId,
                'settings.stay.text',
                channel.id,
            );
        }
        return PlayerResponse.Success;
    }

    /**
     * Clear the queue.
     * @returns Whether or not the queue was cleared.
     */
    async clear(): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        if (this.player.queue.tracks.length === 0) {
            return PlayerResponse.QueueInsufficientTracks;
        }
        this.player.queue.clear();
        if (settings.features.web.enabled) {
            io.to(`guild:${this.player.guildId}`).emit('queueUpdate', []);
        }
        return PlayerResponse.Success;
    }

    /**
     * Disconnects and cleans up the player.
     * @param channelId - The channel to disconnect from.
     * @returns Whether or not the player was disconnected.
     */
    async disconnect(channelId?: Snowflake): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        if (
            await data.guild.get(this.player.guildId, 'settings.stay.enabled')
        ) {
            return PlayerResponse.FeatureConflict;
        }
        clearTimeout(this.player.timeout);
        clearTimeout(this.player.pauseTimeout);
        this.player.disconnect();
        await this.client.music.destroyPlayer(this.player.guildId);
        if (settings.features.web.enabled) {
            io.to(`guild:${this.player.guildId}`).emit('playerDisconnect');
        }
        const voiceChannel = this.client.guilds.cache
            .get(this.player.guildId)
            ?.channels.cache.get(channelId ?? this.player.channelId);
        if (voiceChannel?.type !== ChannelType.GuildStageVoice) {
            return PlayerResponse.Success;
        }
        const permissions = this.client.guilds.cache
            .get(this.player.guildId)
            ?.channels.cache.get(channelId ?? this.player.channelId)
            .permissionsFor(this.client.user.id);
        if (
            !permissions?.has(
                new PermissionsBitField([
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.Connect,
                    PermissionsBitField.Flags.Speak,
                ]),
            )
        ) {
            return PlayerResponse.Success;
        }
        if (!permissions?.has(PermissionsBitField.StageModerator)) {
            return PlayerResponse.Success;
        }
        const me = await this.client.guilds.cache
            .get(this.player.guildId)
            ?.members.fetchMe();
        if (me.isCommunicationDisabled()) return PlayerResponse.Success;
        if (
            voiceChannel.stageInstance?.topic !==
            (await getGuildLocaleString(
                this.player.guildId,
                'MISC.STAGE_TOPIC',
            ))
        ) {
            return PlayerResponse.Success;
        }
        try {
            await voiceChannel.stageInstance.delete();
        } catch (error) {
            if (error instanceof Error) {
                logger.error({
                    message: `${error.message}\n${error.stack}`,
                    label: 'Quaver',
                });
            }
        }
        return PlayerResponse.Success;
    }

    /**
     * Change the looping mode.
     * @param type - The type of looping to use.
     * @returns Whether or not the looping mode was changed.
     */
    async loop(type: LoopType): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        this.player.queue.setLoop(type);
        if (settings.features.web.enabled) {
            io.to(`guild:${this.player.guildId}`).emit('loopUpdate', type);
        }
        return PlayerResponse.Success;
    }

    /**
     * Move a track in the queue.
     * @param oldPosition - The old position of the track.
     * @param newPosition - The new position of the track.
     * @returns Whether or not the track was moved.
     */
    async move(
        oldPosition: number,
        newPosition: number,
    ): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        if (this.player.queue.tracks.length <= 1) {
            return PlayerResponse.QueueInsufficientTracks;
        }
        if (
            oldPosition > this.player.queue.tracks.length ||
            newPosition > this.player.queue.tracks.length
        ) {
            return PlayerResponse.InputOutOfRange;
        }
        if (oldPosition === newPosition) return PlayerResponse.InputInvalid;
        this.player.queue.tracks.splice(
            newPosition - 1,
            0,
            this.player.queue.tracks.splice(oldPosition - 1, 1)[0],
        );
        if (settings.features.web.enabled) {
            io.to(`guild:${this.player.guildId}`).emit(
                'queueUpdate',
                this.player.queue.tracks.map((t: QuaverSong): QuaverSong => {
                    const user = this.client.users.cache.get(t.requester);
                    t.requesterTag = user?.tag;
                    t.requesterAvatar = user?.avatar;
                        return t;
                }),
            );
        }
        if (
            await data.guild.get<boolean>(
                this.player.guildId,
                'settings.smartqueue',
            )
        ) {
            await this.sort();
        }
        return PlayerResponse.Success;
    }

    /**
     * Toggle nightcore mode.
     * @param enabled - Whether or not the feature is enabled.
     * @returns Whether or not the feature was enabled.
     */
    async nightcore(enabled: boolean): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        this.player.filters.timescale = enabled
            ? { speed: 1.125, pitch: 1.125, rate: 1 }
            : undefined;
        await this.player.setFilters();
        this.player.nightcore = enabled;
        if (settings.features.web.enabled) {
            io.to(`guild:${this.player.guildId}`).emit('filterUpdate', {
                bassboost: this.player.bassboost,
                nightcore: this.player.nightcore,
            });
        }
        return PlayerResponse.Success;
    }

    /**
     * Pause the player.
     * @returns Whether or not the player was paused.
     */
    async pause(): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        if (this.player.paused) {
            return PlayerResponse.PlayerStateUnchanged;
        }
        await this.player.pause();
        if (settings.features.web.enabled) {
            io.to(`guild:${this.player.guildId}`).emit(
                'pauseUpdate',
                this.player.paused,
            );
        }
        return PlayerResponse.Success;
    }

    /**
     * Remove a track from the queue.
     * @param position - The position of the track.
     * @returns Whether or not the track was removed.
     */
    async remove(position: number): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        if (this.player.queue.tracks.length === 0) {
            return PlayerResponse.QueueInsufficientTracks;
        }
        if (position > this.player.queue.tracks.length) {
            return PlayerResponse.InputOutOfRange;
        }
        this.player.queue.remove(position - 1);
        if (settings.features.web.enabled) {
            io.to(`guild:${this.player.guildId}`).emit(
                'queueUpdate',
                this.player.queue.tracks.map((t: QuaverSong): QuaverSong => {
                    const user = this.client.users.cache.get(t.requester);
                    t.requesterTag = user?.tag;
                    t.requesterAvatar = user?.avatar;
                        return t;
                }),
            );
        }
        if (
            await data.guild.get<boolean>(
                this.player.guildId,
                'settings.smartqueue',
            )
        ) {
            await this.sort();
        }
        return PlayerResponse.Success;
    }

    /**
     * Resume the player.
     * @returns Whether or not the player was resumed.
     */
    async resume(): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        if (!this.player.paused) {
            return PlayerResponse.PlayerStateUnchanged;
        }
        await this.player.resume();
        if (!this.player.playing && this.player.queue.tracks.length > 0) {
            await this.player.queue.start();
        }
        if (settings.features.web.enabled) {
            io.to(`guild:${this.player.guildId}`).emit(
                'pauseUpdate',
                this.player.paused,
            );
        }
        return PlayerResponse.Success;
    }

    /**
     * Seek to a position in the current track.
     * @param position - The position of the track to seek to.
     * @returns Whether or not the seeking was successful.
     */
    async seek(position: number): Promise<PlayerResponse> {
        if (
            !this.player.queue.current ||
            (!this.player.playing && !this.player.paused)
        ) {
            return PlayerResponse.PlayerIdle;
        }
        if (this.player.queue.current.isStream) {
            return PlayerResponse.PlayerIsStream;
        }
        if (position > this.player.queue.current.length) {
            return PlayerResponse.InputOutOfRange;
        }
        await this.player.seek(position);
        return PlayerResponse.Success;
    }

    /**
     * Shuffle the queue.
     * @returns Whether or not the queue was shuffled.
     */
    async shuffle(): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        if (this.player.queue.tracks.length <= 1) {
            return PlayerResponse.QueueInsufficientTracks;
        }
        let currentIndex = this.player.queue.tracks.length,
            randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [
                this.player.queue.tracks[currentIndex],
                this.player.queue.tracks[randomIndex],
            ] = [
                this.player.queue.tracks[randomIndex],
                this.player.queue.tracks[currentIndex],
            ];
        }
        if (settings.features.web.enabled) {
            io.to(`guild:${this.player.guildId}`).emit(
                'queueUpdate',
                this.player.queue.tracks.map((t: QuaverSong): QuaverSong => {
                    const user = this.client.users.cache.get(t.requester);
                    t.requesterTag = user?.tag;
                    t.requesterAvatar = user?.avatar;
                        return t;
                }),
            );
        }
        if (
            await data.guild.get<boolean>(
                this.player.guildId,
                'settings.smartqueue',
            )
        ) {
            await this.sort();
        }
        return PlayerResponse.Success;
    }

    /**
     * Sort the queue. (Smart Queue)
     * @returns Whether or not the queue was sorted.
     */
    async sort(): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        if (!settings.features.smartqueue.enabled) {
            return PlayerResponse.FeatureDisabled;
        }
        if (settings.features.smartqueue.whitelist) {
            const whitelisted = await getGuildFeatureWhitelisted(
                this.player.guildId,
                'smartqueue',
            );
            if (
                whitelisted === WhitelistStatus.NotWhitelisted ||
                whitelisted === WhitelistStatus.Expired
            ) {
                return PlayerResponse.FeatureNotWhitelisted;
            }
        }
        this.player.queue.tracks = sortQueue(this.player.queue.tracks);
        if (settings.features.web.enabled) {
            io.to(`guild:${this.player.guildId}`).emit(
                'queueUpdate',
                this.player.queue.tracks.map((t: QuaverSong): QuaverSong => {
                    const user = this.client.users.cache.get(t.requester);
                    t.requesterTag = user?.tag;
                    t.requesterAvatar = user?.avatar;
                        return t;
                }),
            );
        }
        return PlayerResponse.Success;
    }

    /**
     * Skip the current track.
     * @returns Whether or not the track was skipped.
     */
    async skip(): Promise<PlayerResponse> {
        if (
            !this.player.queue.current ||
            (!this.player.playing && !this.player.paused)
        ) {
            return PlayerResponse.PlayerIdle;
        }
        await this.player.queue.skip();
        await this.player.queue.start();
        return PlayerResponse.Success;
    }

    /**
     * Stop the player.
     * @returns Whether or not the player was stopped.
     */
    async stop(): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        if (
            !this.player.queue.current ||
            (!this.player.playing && !this.player.paused)
        ) {
            return PlayerResponse.PlayerIdle;
        }
        this.player.queue.clear();
        await this.player.queue.skip();
        await this.player.queue.start();
        if (settings.features.web.enabled) {
            io.to(`guild:${this.player.guildId}`).emit('queueUpdate', []);
        }
        return PlayerResponse.Success;
    }

    /**
     * Set the volume of the player.
     * @param volume - The volume to set the player to.
     * @returns Whether or not the volume was set.
     */
    async volume(volume: number): Promise<PlayerResponse> {
        const { io } = await import('#src/main.js');
        await this.player.setVolume(volume);
        if (settings.features.web.enabled) {
            io.to(`guild:${this.player.guildId}`).emit('volumeUpdate', volume);
        }
        return PlayerResponse.Success;
    }
}
