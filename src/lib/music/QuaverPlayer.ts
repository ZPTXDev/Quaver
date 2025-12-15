import {
    type MessageOptionsBuilderInputs,
    type MessageOptionsBuilderOptions,
    MessageOptionsBuilderType,
    type QuaverClient,
} from '#src/lib';
import { QuaverGuild, WhitelistStatus } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import { updateHandler } from '#src/lib/state';
import { buildMessageOptions, type QuaverChannels, type QuaverQueue, type QuaverSong, settings, } from '#src/lib/util';
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

export interface QuaverPlayerJSON {
    version: 1;
    guildId: Snowflake;
    voiceChannelId: Snowflake | null;
    textChannelId: Snowflake | null;
    volume: number;
    playing: boolean;
    paused: boolean;
    position: number;
    loop: LoopType;
    queue: {
        current: QuaverSong | null;
        tracks: QuaverSong[];
    };
    effects: {
        bassboost: boolean;
        nightcore: boolean;
    };
    memory: {
        shuffle: boolean;
        alternate: boolean;
        originalQueue?: QuaverSong[];
        shuffledQueue?: string[];
        failureCount?: number;
        skip?: {
            required: number;
            users: Snowflake[];
        };
    };
}

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
        shuffle: boolean;
        alternate: boolean;
        originalQueue?: QuaverSong[];
        shuffledQueue?: string[];
        failureCount?: number;
    } = {
        bassboost: false,
        nightcore: false,
        shuffle: false,
        alternate: false,
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
                logger.error(`${error.message}\n${error.stack}`);
            }
            return undefined;
        }
    }

    get restartReady(): boolean {
        return (
            updateHandler.restartInProgress && (this.paused || !this.playing)
        );
    }

    /**
     * Add a track to the queue.
     * @param tracks - The track(s) to add.
     * @param requesterId - The ID of the user who requested the track(s).
     * @param next - Whether or not to insert the track in the next position.
     * @returns The position of the track in the queue. (e.g. 1 - 10, 34, etc.)
     */
    async addTracksToQueue(
        tracks: QuaverSong | QuaverSong[],
        requesterId: Snowflake,
        next = false,
    ): Promise<PlayerResponse | string> {
        if (updateHandler.restartInProgress) {
            return PlayerResponse.RestartInProgress;
        }
        const added = Array.isArray(tracks) ? tracks : [tracks];
        const wasEmptyBeforeAdd =
            !this.queue.current && this.queue.tracks.length === 0;
        this.queue.add(added, { requester: requesterId, next });
        const transformsActive = this.memory.shuffle || this.memory.alternate;
        if (transformsActive) {
            if (!this.memory.originalQueue) {
                this.memory.originalQueue = [...this.queue.tracks];
            } else if (next && this.queue.current) {
                const base = this.memory.originalQueue;
                base.splice(0, 0, ...added);
            } else {
                this.memory.originalQueue.push(...added);
            }
            this.recomputeQueue();
        }
        const positions: number[] = [];
        const ids = new Set(added.map((t): string => t.id));
        if (wasEmptyBeforeAdd) {
            positions.push(0);
            for (let i = 1; i < added.length; i++) {
                positions.push(i);
            }
        } else {
            for (let i = 0; i < this.queue.tracks.length; i++) {
                if (ids.has(this.queue.tracks[i].id)) {
                    positions.push(i + 1);
                }
            }
        }
        let result: string;
        if (positions.length === 0) {
            result = '?';
        } else if (positions.length === 1) {
            result = positions[0].toString();
        } else if (
            positions.every(
                (v, i): boolean => i === 0 || v === positions[i - 1] + 1,
            )
        ) {
            result = `${positions[0]} - ${positions[positions.length - 1]}`;
        } else {
            const firstFive = positions.slice(0, 5).join(', ');
            result = positions.length > 5 ? `${firstFive}, ...` : firstFive;
        }
        if (!this.playing && !this.paused) {
            await this.queue.start();
        }
        return result;
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
                    logger.info(`[G ${g.id}] Disconnecting (inactivity)`);
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
        if (
            enabled !==
            !!this.effects.toJSON().find((e): boolean => e.id === 'bassboost')
        ) {
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
        delete this.memory.originalQueue;
        delete this.memory.shuffledQueue;
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
                logger.error(`${error.message}\n${error.stack}`);
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
            oldPosition < 1 ||
            newPosition < 1 ||
            oldPosition > this.queue.tracks.length ||
            newPosition > this.queue.tracks.length
        ) {
            return PlayerResponse.InputOutOfRange;
        }
        const guild = await QuaverGuild.wrap(this.guild);
        const transformsActive = this.memory.shuffle || this.memory.alternate;
        // When no transforms, move from this.queue.tracks directly
        if (!transformsActive) {
            const moved = this.queue.tracks.splice(oldPosition - 1, 1)[0];
            this.queue.tracks.splice(newPosition - 1, 0, moved);
            guild.sendWebUpdate(
                'queueUpdate',
                this.queue.tracks.map(
                    (t): QuaverSong => ({
                        ...t,
                        requesterTag: this.client.users.cache.get(t.requesterId)
                            ?.tag,
                        requesterAvatar: this.client.users.cache.get(
                            t.requesterId,
                        )?.avatar,
                    }),
                ),
            );
            return PlayerResponse.Success;
        }
        const visible = this.queue.tracks;
        const fromSong = visible[oldPosition - 1];
        const toSong = visible[newPosition - 1];
        const base = this.memory.originalQueue!;
        const fromIdx = base.findIndex((s): boolean => s.id === fromSong.id);
        let toIdx = base.findIndex((s): boolean => s.id === toSong.id);
        if (fromIdx === -1 || toIdx === -1) return PlayerResponse.InputInvalid;
        const [moved] = base.splice(fromIdx, 1);
        if (fromIdx < toIdx) toIdx--;
        base.splice(toIdx, 0, moved);
        this.recomputeQueue();
        guild.sendWebUpdate(
            'queueUpdate',
            this.queue.tracks.map(
                (t): QuaverSong => ({
                    ...t,
                    requesterTag: this.client.users.cache.get(t.requesterId)
                        ?.tag,
                    requesterAvatar: this.client.users.cache.get(t.requesterId)
                        ?.avatar,
                }),
            ),
        );
        return PlayerResponse.Success;
    }

    /**
     * Toggle nightcore mode.
     * @param enabled - Whether or not the feature is enabled.
     * @returns Whether or not the feature was enabled.
     */
    async setNightcore(enabled: boolean): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        if (
            enabled !==
            !!this.effects.toJSON().find((e): boolean => e.id === 'nightcore')
        ) {
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
        // we only prevent pausing / resuming when we triggered the pause
        // after pausing, we'll set restartReady to true, indicating end of a track
        // (only for restartStrategy: track)
        if (this.restartReady) return PlayerResponse.RestartInProgress;
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
        if (this.queue.tracks.length === 0)
            return PlayerResponse.QueueInsufficientTracks;
        if (position < 1 || position > this.queue.tracks.length)
            return PlayerResponse.InputOutOfRange;
        const guild = await QuaverGuild.wrap(this.guild);
        const transformsActive = this.memory.shuffle || this.memory.alternate;
        const visible = this.queue.tracks;
        const removedSong = visible[position - 1];
        this.queue.remove(position - 1);
        if (transformsActive && this.memory.originalQueue) {
            // Remove from canonical order
            const base = this.memory.originalQueue;
            const baseIdx = base.findIndex(
                (s): boolean => s.id === removedSong.id,
            );
            if (baseIdx !== -1) base.splice(baseIdx, 1);
            // Remove from shuffledQueue if present
            if (this.memory.shuffledQueue) {
                const idx = this.memory.shuffledQueue.indexOf(removedSong.id);
                if (idx !== -1) this.memory.shuffledQueue.splice(idx, 1);
            }
            // Recompute final visible queue
            this.recomputeQueue();
        }
        guild.sendWebUpdate(
            'queueUpdate',
            this.queue.tracks.map(
                (t): QuaverSong => ({
                    ...t,
                    requesterTag: this.client.users.cache.get(t.requesterId)
                        ?.tag,
                    requesterAvatar: this.client.users.cache.get(t.requesterId)
                        ?.avatar,
                }),
            ),
        );
        return PlayerResponse.Success;
    }

    /**
     * Seek to a position in the current track.
     * @param position - The position of the track to seek to.
     * @returns Whether or not the seeking was successful.
     */
    async seekTo(position: number): Promise<PlayerResponse> {
        if (this.restartReady) return PlayerResponse.RestartInProgress;
        if (!this.queue.current || (!this.playing && !this.paused)) {
            return PlayerResponse.PlayerIdle;
        }
        if (this.queue.current.info.isStream) {
            return PlayerResponse.PlayerIsStream;
        }
        if (position < 0 || position > this.queue.current.info.length) {
            return PlayerResponse.InputOutOfRange;
        }
        await this.seek(position);
        return PlayerResponse.Success;
    }

    private shuffleQueue(base: QuaverSong[]): QuaverSong[] {
        if (base.length === 0) return [];
        const ids = base.map((s): string => s.id);
        // If we already have a shuffledQueue, reuse it and only
        // sync changes (added/removed tracks) instead of reshuffling.
        if (!this.memory.shuffledQueue) {
            // Initial shuffle: Fisher–Yates on ids
            const arr = [...ids];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            this.memory.shuffledQueue = arr;
        } else {
            // Sync existing shuffledQueue with current base
            const inBase = new Set(ids);
            // 1. Drop ids that no longer exist
            const shuffled = this.memory.shuffledQueue.filter((id): boolean =>
                inBase.has(id),
            );
            // 2. Add new ids (those not in shuffled yet) at random positions
            const inShuffled = new Set(shuffled);
            const missing = ids.filter((id): boolean => !inShuffled.has(id));
            for (const id of missing) {
                const pos = Math.floor(Math.random() * (shuffled.length + 1));
                shuffled.splice(pos, 0, id);
            }
            this.memory.shuffledQueue = shuffled;
        }
        const byId = new Map<string, QuaverSong>(
            base.map((song): [string, QuaverSong] => [song.id, song]),
        );
        return this.memory.shuffledQueue
            .map((id): QuaverSong | undefined => byId.get(id))
            .filter((s): s is QuaverSong => !!s);
    }

    private alternateQueue(base: QuaverSong[]): QuaverSong[] {
        if (base.length === 0) return [];
        const groups = new Map<Snowflake, QuaverSong[]>();
        for (const song of base) {
            if (!groups.has(song.requesterId)) groups.set(song.requesterId, []);
            groups.get(song.requesterId)!.push(song);
        }
        const result: QuaverSong[] = [];
        while ([...groups.values()].some((g): boolean => g.length > 0)) {
            for (const songs of groups.values()) {
                if (songs.length > 0) {
                    result.push(songs.shift()!);
                }
            }
        }
        return result;
    }

    recomputeQueue(): void {
        const transformsActive = this.memory.shuffle || this.memory.alternate;
        if (!transformsActive) {
            delete this.memory.originalQueue;
            delete this.memory.shuffledQueue;
            return;
        }
        const current = this.queue.current || null;
        const currentId = current?.id;
        // baseSource EXCLUDES current track
        const baseSource =
            (this.memory.originalQueue ??
                this.queue.tracks.filter(
                    (t: QuaverSong): boolean => t.id !== currentId,
                )) ||
            [];
        let transformed = [...baseSource];
        if (this.memory.shuffle) {
            transformed = this.shuffleQueue(transformed);
        } else {
            delete this.memory.shuffledQueue;
        }
        if (this.memory.alternate) {
            // INCLUDE current for fairness
            const withCurrent = current
                ? [current, ...transformed]
                : transformed;
            const alternated = this.alternateQueue(withCurrent);
            // REMOVE current again after alternation
            transformed = alternated.filter((t): boolean => t.id !== currentId);
        }
        this.queue.tracks = transformed;
    }

    /**
     * Toggle shuffle.
     * @param enabled - Whether or not to enable shuffle.
     * @returns Whether or not shuffle was enabled.
     */
    async setShuffle(enabled: boolean): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        const wasActive = this.memory.shuffle || this.memory.alternate;
        this.memory.shuffle = enabled;
        const isActive = this.memory.shuffle || this.memory.alternate;
        if (!wasActive && isActive) {
            // First time any transform is turned on → snapshot.
            this.memory.originalQueue = [...this.queue.tracks];
        }
        if (wasActive && !isActive) {
            // All transforms are now off → restore and clear state.
            if (this.memory.originalQueue) {
                this.queue.tracks = [...this.memory.originalQueue];
            }
            delete this.memory.originalQueue;
            delete this.memory.shuffledQueue;
        } else {
            this.recomputeQueue();
        }
        guild.sendWebUpdate('shuffleUpdate', enabled);
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
     * Toggle alternating (smart queue).
     * @param enabled - Whether or not to enable alternating.
     * @returns Whether or not alternating was enabled.
     */
    async setAlternate(enabled: boolean): Promise<PlayerResponse> {
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
        const wasActive = this.memory.shuffle || this.memory.alternate;
        this.memory.alternate = enabled;
        const isActive = this.memory.shuffle || this.memory.alternate;
        if (!wasActive && isActive) {
            // First time any transform is turned on → snapshot.
            this.memory.originalQueue = [...this.queue.tracks];
        }
        if (wasActive && !isActive) {
            // All transforms off → restore and clear.
            if (this.memory.originalQueue) {
                this.queue.tracks = [...this.memory.originalQueue];
            }
            delete this.memory.originalQueue;
            delete this.memory.shuffledQueue;
        } else {
            this.recomputeQueue();
        }
        guild.sendWebUpdate('smartQueueFeatureUpdate', { enabled });
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
        if (this.restartReady) return PlayerResponse.RestartInProgress;
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
        if (this.restartReady) return PlayerResponse.RestartInProgress;
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
        delete this.memory.originalQueue;
        delete this.memory.shuffledQueue;
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

    toJSON(): QuaverPlayerJSON {
        return {
            version: 1,
            guildId: this.guild.id,
            voiceChannelId: this.voice.channelId ?? null,
            textChannelId: this.queue.channel?.id ?? null,
            volume: this.volume,
            playing: this.playing,
            paused: this.paused,
            position: this.position ?? 0,
            loop: this.queue.loop.type,
            queue: {
                current: this.queue.current ?? null,
                tracks: [...this.queue.tracks],
            },
            effects: {
                bassboost: this.memory.bassboost,
                nightcore: this.memory.nightcore,
            },
            memory: {
                shuffle: this.memory.shuffle,
                alternate: this.memory.alternate,
                originalQueue: this.memory.originalQueue
                    ? [...this.memory.originalQueue]
                    : undefined,
                shuffledQueue: this.memory.shuffledQueue
                    ? [...this.memory.shuffledQueue]
                    : undefined,
                failureCount: this.memory.failureCount,
                skip: this.memory.skip
                    ? {
                          required: this.memory.skip.required,
                          users: [...this.memory.skip.users],
                      }
                    : undefined,
            },
        };
    }
}
