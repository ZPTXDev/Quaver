import {
    type MessageOptionsBuilderInputs,
    type MessageOptionsBuilderOptions,
    MessageOptionsBuilderType,
    type QuaverClient,
} from '#src/lib';
import { QuaverGuild, WhitelistStatus } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import {
    buildMessageOptions,
    type QuaverChannels,
    type QuaverQueue,
    type QuaverSong,
    settings,
    sortQueue,
} from '#src/lib/util';
import type { PlayerEffect } from '@lavaclient/plugin-effects';
import { type LoopType, Queue } from '@lavaclient/plugin-queue';
import {
    ChannelType,
    type Guild,
    type Message,
    type MessageCreateOptions,
    MessageFlags,
    PermissionsBitField,
    type Snowflake,
} from 'discord.js';
import { type Node, Player } from 'lavaclient';
import { PlayerResponse } from '.';

const effects: Record<string, PlayerEffect> = {
    bassboost: {
        id: 'bassboost',
        filters: {
            equalizer: [
                {
                    band: 0,
                    gain: 0.2,
                },
                {
                    band: 1,
                    gain: 0.15,
                },
                {
                    band: 2,
                    gain: 0.1,
                },
                {
                    band: 3,
                    gain: 0.05,
                },
                {
                    band: 4,
                    gain: 0.0,
                },
                ...Array.from({ length: 10 }).map(
                    (_, i): { band: number; gain: number } => ({
                        band: i + 5,
                        gain: -0.05,
                    }),
                ),
            ],
        },
    },
    nightcore: {
        id: 'nightcore',
        filters: {
            timescale: {
                speed: 1.125,
                pitch: 1.125,
                rate: 1,
            },
        },
    },
};

export class QuaverPlayer<TNode extends Node = Node> extends Player<TNode> {
    client: QuaverClient;
    guild: Guild;
    timeout: {
        standard?: ReturnType<typeof setTimeout>;
        pause?: ReturnType<typeof setTimeout>;
        end?: number;
    } = {};
    // overriding native queue type
    queue: QuaverQueue;
    memory: {
        bassboost: boolean;
        nightcore: boolean;
        skip?: {
            required: number;
            users: Snowflake[];
        };
        failureCount?: number;
    } = {
        bassboost: false,
        nightcore: false,
    };

    constructor(node: TNode, guild: Guild) {
        super(node, guild.id);
        this.client = guild.client as QuaverClient;
        this.guild = guild;
        this.queue = new Queue(this, {
            play: async (_, track): Promise<void> =>
                void (await this.play(track)),
        }) as QuaverQueue;
        this.queue.channel = null;
        this.queue.current = null;
        this.queue.tracks = [];
    }

    /**
     * Sends a message to the bound text channel.
     * @param inputData - The data to be used. Can be a string, ContainerBuilder, or an array of either.
     * @param options - Extra data, such as type or components, or files.
     * @returns The message that was sent.
     */
    async sendMessage(
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
        }) as MessageCreateOptions;
        sendMsgOpts.flags = [MessageFlags.IsComponentsV2];
        sendMsgOpts.allowedMentions = { parse: [] };
        const channel = this.queue.channel;
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
        if (this.guild.members.me.isCommunicationDisabled()) {
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
     * Toggle 24/7 mode.
     * @param enabled - Whether or not the feature is enabled.
     * @returns Whether or not the feature was enabled.
     */
    async setStay(enabled: boolean): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        if (!settings.features.stay.enabled) {
            return PlayerResponse.FeatureDisabled;
        }
        if (settings.features.stay.whitelist) {
            const whitelisted = await guild.features.checkWhitelisted('stay');
            if (
                whitelisted === WhitelistStatus.NotWhitelisted ||
                whitelisted === WhitelistStatus.Expired
            ) {
                return PlayerResponse.FeatureNotWhitelisted;
            }
        }
        if (!this.queue.channel?.id) {
            return PlayerResponse.QueueChannelMissing;
        }
        await guild.settings.set('stay.enabled', enabled);
        if (enabled) {
            await guild.settings.set('stay.channel', this.voice.channelId);
            await guild.settings.set('stay.text', this.queue.channel.id);
            if (this.timeout.standard) {
                clearTimeout(this.timeout.standard);
                delete this.timeout.standard;
                guild.sendWebUpdate('timeoutUpdate', !!this.timeout.standard);
            }
        } else if (!this.queue.current || (!this.playing && !this.paused)) {
            if (this.timeout.standard) clearTimeout(this.timeout.standard);
            this.timeout.standard = setTimeout(
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
                30 * 60 * 1000,
                this,
                guild,
            );
            this.timeout.end = Date.now() + 30 * 60 * 1000;
            guild.sendWebUpdate('timeoutUpdate', this.timeout.end);
        }
        guild.sendWebUpdate('stayFeatureUpdate', { enabled });
        return PlayerResponse.Success;
    }

    /**
     * Toggle bass boost mode.
     * @param enabled - Whether or not the feature is enabled.
     * @returns Whether or not the feature was enabled.
     */
    async setBassboost(enabled: boolean): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        const response = await this.effects.toggle(effects.bassboost);
        if (response !== enabled) {
            await this.effects.toggle(effects.bassboost);
        }
        this.memory.bassboost = enabled;
        guild.sendWebUpdate('filterUpdate', {
            bassboost: this.memory.bassboost,
            nightcore: this.memory.nightcore,
        });
        return PlayerResponse.Success;
    }

    /**
     * Bind the player to a text channel.
     * @param channel - The channel to bind to.
     * @returns Whether or not the player was bound.
     */
    async bindTextChannel(channel: QuaverChannels): Promise<PlayerResponse> {
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
        const guild = await QuaverGuild.wrap(this.guild);
        this.queue.channel = channel;
        guild.sendWebUpdate('textChannelUpdate', channel.name);
        if (await guild.settings.get('stay.enabled')) {
            await guild.settings.set('stay.text', channel.id);
        }
        return PlayerResponse.Success;
    }

    /**
     * Clear the queue.
     * @returns Whether or not the queue was cleared.
     */
    async clearQueue(): Promise<PlayerResponse> {
        if (this.queue.tracks.length === 0) {
            return PlayerResponse.QueueInsufficientTracks;
        }
        const guild = await QuaverGuild.wrap(this.guild);
        this.queue.clear();
        guild.sendWebUpdate('queueUpdate', []);
        return PlayerResponse.Success;
    }

    /**
     * Disconnects and cleans up the player.
     * @param channelId - The channel to disconnect from.
     * @returns Whether or not the player was disconnected.
     */
    async disconnect(channelId?: Snowflake): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        if (await guild.settings.get('stay.enabled')) {
            return PlayerResponse.FeatureConflict;
        }
        clearTimeout(this.timeout.standard);
        clearTimeout(this.timeout.pause);
        this.voice.disconnect();
        await this.client.music.players.destroy(guild.id);
        guild.sendWebUpdate('playerDisconnect');
        const voiceChannel = this.client.guilds.cache
            .get(guild.id)
            ?.channels.cache.get(channelId ?? this.voice.channelId);
        if (voiceChannel?.type !== ChannelType.GuildStageVoice) {
            return PlayerResponse.Success;
        }
        const permissions = this.client.guilds.cache
            .get(guild.id)
            ?.channels.cache.get(channelId ?? this.voice.channelId)
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
            .get(guild.id)
            ?.members.fetchMe();
        if (me.isCommunicationDisabled()) return PlayerResponse.Success;
        if (
            voiceChannel.stageInstance?.topic !==
            guild.locale('MISC.STAGE_TOPIC')
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
    async setLoopMode(type: LoopType): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        this.queue.setLoop(type);
        guild.sendWebUpdate('loopUpdate', type);
        return PlayerResponse.Success;
    }

    /**
     * Move a track in the queue.
     * @param oldPosition - The old position of the track.
     * @param newPosition - The new position of the track.
     * @returns Whether or not the track was moved.
     */
    async moveQueuedTrack(
        oldPosition: number,
        newPosition: number,
    ): Promise<PlayerResponse> {
        if (this.queue.tracks.length <= 1) {
            return PlayerResponse.QueueInsufficientTracks;
        }
        if (
            oldPosition > this.queue.tracks.length ||
            newPosition > this.queue.tracks.length
        ) {
            return PlayerResponse.InputOutOfRange;
        }
        if (oldPosition === newPosition) return PlayerResponse.InputInvalid;
        const guild = await QuaverGuild.wrap(this.guild);
        this.queue.tracks.splice(
            newPosition - 1,
            0,
            this.queue.tracks.splice(oldPosition - 1, 1)[0],
        );
        guild.sendWebUpdate(
            'queueUpdate',
            this.queue.tracks.map((t: QuaverSong): QuaverSong => {
                const user = this.client.users.cache.get(t.requesterId);
                t.requesterTag = user?.tag;
                t.requesterAvatar = user?.avatar;
                return t;
            }),
        );
        if (await guild.settings.get<boolean>('smartqueue')) {
            await this.sortQueue();
        }
        return PlayerResponse.Success;
    }

    /**
     * Toggle nightcore mode.
     * @param enabled - Whether or not the feature is enabled.
     * @returns Whether or not the feature was enabled.
     */
    async setNightcore(enabled: boolean): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        const response = await this.effects.toggle(effects.nightcore);
        if (response !== enabled) {
            await this.effects.toggle(effects.nightcore);
        }
        this.memory.nightcore = enabled;
        guild.sendWebUpdate('filterUpdate', {
            bassboost: this.memory.bassboost,
            nightcore: this.memory.nightcore,
        });
        return PlayerResponse.Success;
    }

    /**
     * Pause the player.
     * @param paused - Whether or not to pause the player.
     * @returns Whether or not the player was paused.
     */
    async setPause(paused: boolean): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        if (this.paused === paused) {
            return PlayerResponse.PlayerStateUnchanged;
        }
        if (paused) {
            await this.pause();
        } else {
            await this.resume();
            if (!this.playing && this.queue.tracks.length > 0) {
                await this.queue.start();
            }
        }
        guild.sendWebUpdate('pauseUpdate', this.paused);
        return PlayerResponse.Success;
    }

    /**
     * Remove a track from the queue.
     * @param position - The position of the track.
     * @returns Whether or not the track was removed.
     */
    async removeQueuedTrack(position: number): Promise<PlayerResponse> {
        if (this.queue.tracks.length === 0) {
            return PlayerResponse.QueueInsufficientTracks;
        }
        if (position > this.queue.tracks.length) {
            return PlayerResponse.InputOutOfRange;
        }
        const guild = await QuaverGuild.wrap(this.guild);
        this.queue.remove(position - 1);
        guild.sendWebUpdate(
            'queueUpdate',
            this.queue.tracks.map((t: QuaverSong): QuaverSong => {
                const user = this.client.users.cache.get(t.requesterId);
                t.requesterTag = user?.tag;
                t.requesterAvatar = user?.avatar;
                return t;
            }),
        );
        if (await guild.settings.get<boolean>('smartqueue')) {
            await this.sortQueue();
        }
        return PlayerResponse.Success;
    }

    /**
     * Seek to a position in the current track.
     * @param position - The position of the track to seek to.
     * @returns Whether or not the seeking was successful.
     */
    async seekTo(position: number): Promise<PlayerResponse> {
        if (!this.queue.current || (!this.playing && !this.paused)) {
            return PlayerResponse.PlayerIdle;
        }
        if (this.queue.current.info.isStream) {
            return PlayerResponse.PlayerIsStream;
        }
        if (position > this.queue.current.info.length) {
            return PlayerResponse.InputOutOfRange;
        }
        await this.seek(position);
        return PlayerResponse.Success;
    }

    /**
     * Shuffle the queue.
     * @returns Whether or not the queue was shuffled.
     */
    async shuffleQueue(): Promise<PlayerResponse> {
        if (this.queue.tracks.length <= 1) {
            return PlayerResponse.QueueInsufficientTracks;
        }
        const guild = await QuaverGuild.wrap(this.guild);
        let currentIndex = this.queue.tracks.length,
            randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [this.queue.tracks[currentIndex], this.queue.tracks[randomIndex]] =
                [
                    this.queue.tracks[randomIndex],
                    this.queue.tracks[currentIndex],
                ];
        }
        guild.sendWebUpdate(
            'queueUpdate',
            this.queue.tracks.map((t: QuaverSong): QuaverSong => {
                const user = this.client.users.cache.get(t.requesterId);
                t.requesterTag = user?.tag;
                t.requesterAvatar = user?.avatar;
                return t;
            }),
        );
        if (await guild.settings.get<boolean>('smartqueue')) {
            await this.sortQueue();
        }
        return PlayerResponse.Success;
    }

    /**
     * Sort the queue. (Smart Queue)
     * @returns Whether or not the queue was sorted.
     */
    async sortQueue(): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        if (!settings.features.smartqueue.enabled) {
            return PlayerResponse.FeatureDisabled;
        }
        if (settings.features.smartqueue.whitelist) {
            const whitelisted =
                await guild.features.checkWhitelisted('smartqueue');
            if (
                whitelisted === WhitelistStatus.NotWhitelisted ||
                whitelisted === WhitelistStatus.Expired
            ) {
                return PlayerResponse.FeatureNotWhitelisted;
            }
        }
        this.queue.tracks = sortQueue(this.queue.tracks);
        guild.sendWebUpdate(
            'queueUpdate',
            this.queue.tracks.map((t: QuaverSong): QuaverSong => {
                const user = this.client.users.cache.get(t.requesterId);
                t.requesterTag = user?.tag;
                t.requesterAvatar = user?.avatar;
                return t;
            }),
        );
        return PlayerResponse.Success;
    }

    /**
     * Skip the current track.
     * @returns Whether or not the track was skipped.
     */
    async skipCurrentTrack(): Promise<PlayerResponse> {
        if (!this.queue.current || (!this.playing && !this.paused)) {
            return PlayerResponse.PlayerIdle;
        }
        await this.queue.skip();
        await this.queue.start();
        return PlayerResponse.Success;
    }

    /**
     * Skip to a specific position in the queue.
     * @param position - The position to skip to.
     * @returns Whether or not the player was skipped to the position.
     */
    async skipToQueuedTrack(position: number): Promise<PlayerResponse> {
        if (this.queue.tracks.length > 1) {
            const moveResponse = await this.moveQueuedTrack(position, 1);
            if (moveResponse !== PlayerResponse.Success) {
                return moveResponse;
            }
        }
        const skipResponse = await this.skipCurrentTrack();
        if (skipResponse !== PlayerResponse.Success) {
            return skipResponse;
        }
        return PlayerResponse.Success;
    }

    /**
     * Stop (and reset) the player.
     * @returns Whether or not the player was stopped.
     */
    async reset(): Promise<PlayerResponse> {
        if (!this.queue.current || (!this.playing && !this.paused)) {
            return PlayerResponse.PlayerIdle;
        }
        const guild = await QuaverGuild.wrap(this.guild);
        this.queue.clear();
        await this.queue.skip();
        await this.queue.start();
        guild.sendWebUpdate('queueUpdate', []);
        return PlayerResponse.Success;
    }

    /**
     * Set the volume of the player.
     * @param volume - The volume to set the player to.
     * @returns Whether or not the volume was set.
     */
    async setVolumeTo(volume: number): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        if (volume < 0 || volume > 200) {
            return PlayerResponse.InputOutOfRange;
        }
        await this.setVolume(volume);
        guild.sendWebUpdate('volumeUpdate', volume);
        return PlayerResponse.Success;
    }
}
