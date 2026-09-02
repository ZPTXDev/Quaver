import {
    type MessageOptionsBuilderInputs,
    type MessageOptionsBuilderOptions,
    MessageOptionsBuilderType,
    type QuaverClient,
} from '#src/lib';
import { QuaverGuild, WhitelistStatus } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import { updateHandler } from '#src/lib/state';
import { buildMessageOptions, getTrackMarkdownLocaleString, type QuaverChannels, type QuaverSong, settings, } from '#src/lib/util';
import type { PlayerEffect } from '@lavaclient/plugin-effects';
import { QuaverQueue, type LoopType } from './QuaverQueue';
import { msToTime, msToTimeString } from '@zptxdev/zptx-lib';
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
        adPlaytimeMs?: number;
        preAdPlaytimeMs?: number;
        isAdPlaying?: boolean;
        savedFilters?: {
            bassboost: boolean;
            nightcore: boolean;
        };
        trackStartTime?: number;
        currentNowPlayingMessageId?: Snowflake;
    };
    sessionLogs: {
        timestamp: number;
        action: string;
        userId: string | null;
        userTag: string | null;
        details: string | null;
    }[];
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
        pausedAlone?: boolean;
    } = {};
    // overriding native queue type
    queue!: QuaverQueue;
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
        adPlaytimeMs: number;
        preAdPlaytimeMs?: number;
        isAdPlaying: boolean;
        savedFilters?: {
            bassboost: boolean;
            nightcore: boolean;
        };
        trackStartTime?: number;
        currentNowPlayingMessageId?: Snowflake;
    } = {
        bassboost: false,
        nightcore: false,
        shuffle: false,
        alternate: false,
        adPlaytimeMs: 0,
        isAdPlaying: false,
    };
    sessionLogs: {
        timestamp: number;
        action: string;
        userId: string | null;
        userTag: string | null;
        details: string | null;
    }[] = [];

    constructor(node: TNode, guild: Guild) {
        super(node, guild.id);
        this.client = guild.client as QuaverClient;
        this.guild = guild;
        this.queue = new QuaverQueue(this);
        this.queue.channel = null;
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

    logSessionEvent(
        action: string,
        actor?: { id: string; tag: string } | string | null,
        details: string | null = null,
    ): void {
        let userId: string | null = null;
        let userTag: string | null = null;
        if (actor) {
            if (typeof actor === 'string') {
                userId = actor;
                const user = this.client.users.cache.get(actor);
                userTag = user?.tag ?? null;
            } else {
                userId = actor.id;
                userTag = actor.tag;
            }
        }
        this.sessionLogs.push({
            timestamp: Date.now(),
            action,
            userId,
            userTag,
            details,
        });
        if (this.sessionLogs.length > 100) {
            this.sessionLogs.shift();
        }
        QuaverGuild.wrap(this.guild)
            .then((wrappedGuild): void => {
                wrappedGuild.sendWebUpdate(
                    'sessionLogUpdate',
                    this.sessionLogs,
                );
            })
            .catch((err): void => {
                logger.error(`Error sending web update: ${err.message}`);
            });
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
     * @param next - Whether to insert the track in the next position.
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
            (!this.queue.current || (!this.playing && !this.paused)) &&
            this.queue.tracks.length === 0;
        this.queue.add(added, { requester: { id: requesterId }, next });
        if (added.length === 1) {
            this.logSessionEvent(
                'QUEUE_ADD',
                requesterId,
                `[${added[0].info.title}](${added[0].info.uri})`,
            );
        } else {
            this.logSessionEvent(
                'QUEUE_ADD',
                requesterId,
                `${added.length} tracks`,
            );
        }
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
     * @param enabled - Whether the feature is enabled.
     * @param actor - The user who triggered the change.
     * @returns Whether the feature was enabled.
     */
    async setStay(
        enabled: boolean,
        actor?: { id: string; tag: string } | string | null,
    ): Promise<PlayerResponse> {
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
        this.logSessionEvent('STAY', actor, enabled ? 'ENABLED' : 'DISABLED');
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
     * @param enabled - Whether the feature is enabled.
     * @param suppressWebUpdate - If true, skip sending web update (useful for batching multiple filter changes).
     * @param actor - The user who triggered the change.
     * @returns Whether the feature was enabled.
     */
    async setBassboost(enabled: boolean, suppressWebUpdate = false, actor?: { id: string; tag: string } | string | null): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        this.logSessionEvent(
            'BASSBOOST',
            actor,
            enabled ? 'ENABLED' : 'DISABLED',
        );
        if (
            enabled !==
            !!this.effects.toJSON().find((e): boolean => e.id === 'bassboost')
        ) {
            await this.effects.toggle(effects.bassboost);
        }
        this.memory.bassboost = enabled;
        if (!suppressWebUpdate) {
            guild.sendWebUpdate('filterUpdate', {
                bassboost: this.memory.bassboost,
                nightcore: this.memory.nightcore,
            });
        }
        return PlayerResponse.Success;
    }

    /**
     * Bind the player to a text channel.
     * @param channel - The channel to bind to.
     * @param actor - The user who triggered the change.
     * @returns Whether the player was bound.
     */
    async bindTextChannel(
        channel: QuaverChannels,
        actor?: { id: string; tag: string } | string | null,
    ): Promise<PlayerResponse> {
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
        this.logSessionEvent('BIND', actor, channel.id);
        guild.sendWebUpdate('textChannelUpdate', channel.name);
        if (await guild.settings.get('stay.enabled')) {
            await guild.settings.set('stay.text', channel.id);
        }
        return PlayerResponse.Success;
    }

    /**
     * Clear the queue.
     * @param actor - The user who triggered the change.
     * @returns Whether the queue was cleared.
     */
    async clearQueue(
        actor?: { id: string; tag: string } | string | null,
    ): Promise<PlayerResponse> {
        if (this.queue.tracks.length === 0) {
            return PlayerResponse.QueueInsufficientTracks;
        }
        const guild = await QuaverGuild.wrap(this.guild);
        this.logSessionEvent('QUEUE_CLEAR', actor);
        this.queue.clear();
        delete this.memory.originalQueue;
        delete this.memory.shuffledQueue;
        guild.sendWebUpdate('queueUpdate', []);
        return PlayerResponse.Success;
    }

    /**
     * Disconnects and cleans up the player.
     * @param channelId - The channel to disconnect from.
     * @param actor - The user who triggered the change.
     * @returns Whether the player was disconnected.
     */
    async disconnect(
        channelId?: Snowflake,
        actor?: { id: string; tag: string } | string | null,
    ): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        if (await guild.settings.get('stay.enabled') && await guild.features.isFeatureActive('stay')) {
            return PlayerResponse.FeatureConflict;
        }
        this.logSessionEvent('DISCONNECT', actor);
        clearTimeout(this.timeout.standard);
        clearTimeout(this.timeout.pause);
        this.timeout.pausedAlone = false;
        this.voice.disconnect();
        this.client.connectionHealth.updateMediaEndpoint(null);
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
     * @param actor - The user who triggered the change.
     * @returns Whether the looping mode was changed.
     */
    async setLoopMode(
        type: LoopType,
        actor?: { id: string; tag: string } | string | null,
    ): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        this.queue.setLoop(type);
        let loopStr = 'DISABLED';
        const typeStr = type?.toString().toLowerCase() ?? '';
        if (typeStr === '1' || typeStr === 'song' || typeStr === 'track') {
            loopStr = 'TRACK';
        } else if (typeStr === '2' || typeStr === 'queue') {
            loopStr = 'QUEUE';
        }
        this.logSessionEvent('LOOP', actor, loopStr);
        guild.sendWebUpdate('loopUpdate', type);
        return PlayerResponse.Success;
    }

    /**
     * Move a track in the queue.
     * @param oldPosition - The old position of the track.
     * @param newPosition - The new position of the track.
     * @param actor - The user who triggered the change.
     * @param showArtist - Whether to include the artist name in the session log.
     * @returns Whether the track was moved.
     */
    async moveQueuedTrack(
        oldPosition: number,
        newPosition: number,
        actor?: { id: string; tag: string } | string | null,
        showArtist = false,
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
        // FIXME: Improve UX by allowing move when transforms are active - currently disabled as it's bugged out
        if (this.memory.shuffle || this.memory.alternate) {
            return PlayerResponse.FeatureConflict;
        }
        const guild = await QuaverGuild.wrap(this.guild);
        const moved = this.queue.tracks.splice(oldPosition - 1, 1)[0];
        this.queue.tracks.splice(newPosition - 1, 0, moved);
        this.logSessionEvent(
            'QUEUE_MOVE',
            actor,
            moved
                ? `${getTrackMarkdownLocaleString(moved, showArtist)} \`${oldPosition} -> ${newPosition}\``
                : `\`${oldPosition} -> ${newPosition}\``,
        );
        guild.sendWebUpdate('queueUpdate', this.decorateQueue());
        return PlayerResponse.Success;
    }

    /**
     * Toggle nightcore mode.
     * @param enabled - Whether the feature is enabled.
     * @param suppressWebUpdate - If true, skip sending web update (useful for batching multiple filter changes).
     * @param actor - The user who triggered the change.
     * @returns Whether the feature was enabled.
     */
    async setNightcore(enabled: boolean, suppressWebUpdate = false, actor?: { id: string; tag: string } | string | null): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        this.logSessionEvent(
            'NIGHTCORE',
            actor,
            enabled ? 'ENABLED' : 'DISABLED',
        );
        if (
            enabled !==
            !!this.effects.toJSON().find((e): boolean => e.id === 'nightcore')
        ) {
            await this.effects.toggle(effects.nightcore);
        }
        this.memory.nightcore = enabled;
        if (!suppressWebUpdate) {
            guild.sendWebUpdate('filterUpdate', {
                bassboost: this.memory.bassboost,
                nightcore: this.memory.nightcore,
            });
        }
        return PlayerResponse.Success;
    }

    /**
     * Pause the player.
     * @param paused - Whether to pause the player.
     * @param actor - The user who triggered the change.
     * @returns Whether the player was paused.
     */
    async setPause(
        paused: boolean,
        actor?: { id: string; tag: string } | string | null,
    ): Promise<PlayerResponse> {
        // we only prevent pausing / resuming when we triggered the pause
        // after pausing, we'll set restartReady to true, indicating end of a track
        // (only for restartStrategy: track)
        if (this.restartReady) return PlayerResponse.RestartInProgress;
        if (this.memory.isAdPlaying) return PlayerResponse.AdPlaying;
        const guild = await QuaverGuild.wrap(this.guild);
        if (this.paused === paused) {
            return PlayerResponse.PlayerStateUnchanged;
        }
        if (paused) {
            await this.pause();
        } else {
            await this.resume();
            this.timeout.pausedAlone = false;
            if (!this.playing && this.queue.tracks.length > 0) {
                await this.queue.start();
            }
        }
        this.logSessionEvent(paused ? 'PAUSE' : 'RESUME', actor);
        guild.sendWebUpdate('pauseUpdate', this.paused);
        return PlayerResponse.Success;
    }

    /**
     * Remove a track from the queue.
     * @param position - The position of the track.
     * @param actor - The user who triggered the change.
     * @param showArtist - Whether to include the artist name in the session log.
     * @returns Whether the track was removed.
     */
    async removeQueuedTrack(
        position: number,
        actor?: { id: string; tag: string } | string | null,
        showArtist = false,
    ): Promise<PlayerResponse> {
        if (this.queue.tracks.length === 0)
            return PlayerResponse.QueueInsufficientTracks;
        if (position < 1 || position > this.queue.tracks.length)
            return PlayerResponse.InputOutOfRange;
        const guild = await QuaverGuild.wrap(this.guild);
        const transformsActive = this.memory.shuffle || this.memory.alternate;
        const visible = this.queue.tracks;
        const removedSong = visible[position - 1];
        this.logSessionEvent(
            'QUEUE_REMOVE',
            actor,
            removedSong
                ? getTrackMarkdownLocaleString(removedSong, showArtist)
                : null,
        );
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
        guild.sendWebUpdate('queueUpdate', this.decorateQueue());
        return PlayerResponse.Success;
    }

    /**
     * Seek to a position in the current track.
     * @param position - The position of the track to seek to.
     * @param actor - The user who triggered the change.
     * @returns Whether the seeking was successful.
     */
    async seekTo(
        position: number,
        actor?: { id: string; tag: string } | string | null,
    ): Promise<PlayerResponse> {
        if (this.restartReady) return PlayerResponse.RestartInProgress;
        if (this.memory.isAdPlaying) return PlayerResponse.AdPlaying;
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
        const duration = msToTime(position);
        const durationString = msToTimeString(duration, true);
        this.logSessionEvent('SEEK', actor, durationString);
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
     * @param enabled - Whether to enable shuffle.
     * @param actor - The user who triggered the change.
     * @returns Whether shuffle was enabled.
     */
    async setShuffle(
        enabled: boolean,
        actor?: { id: string; tag: string } | string | null,
    ): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        const wasActive = this.memory.shuffle || this.memory.alternate;
        this.memory.shuffle = enabled;
        this.logSessionEvent(
            'SHUFFLE',
            actor,
            enabled ? 'ENABLED' : 'DISABLED',
        );
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
        guild.sendWebUpdate('queueUpdate', this.decorateQueue());
        return PlayerResponse.Success;
    }

    /**
     * Toggle alternating (smart queue).
     * @param enabled - Whether to enable alternating.
     * @param actor - The user who triggered the change.
     * @returns Whether alternating was enabled.
     */
    async setAlternate(
        enabled: boolean,
        actor?: { id: string; tag: string } | string | null,
    ): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        if (!settings.features.smartqueue.enabled) {
            return PlayerResponse.FeatureDisabled;
        }
        if (enabled && settings.features.smartqueue.whitelist) {
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
        this.logSessionEvent(
            'SMARTQUEUE',
            actor,
            enabled ? 'ENABLED' : 'DISABLED',
        );
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
        guild.sendWebUpdate('queueUpdate', this.decorateQueue());
        return PlayerResponse.Success;
    }

    /**
     * Skip the current track.
     * @param actor - The user who triggered the change.
     * @returns Whether the track was skipped.
     */
    async skipCurrentTrack(
        actor?: { id: string; tag: string } | string | null,
    ): Promise<PlayerResponse> {
        if (this.restartReady) return PlayerResponse.RestartInProgress;
        if (this.memory.isAdPlaying) return PlayerResponse.AdPlaying;
        if (!this.queue.current || (!this.playing && !this.paused)) {
            return PlayerResponse.PlayerIdle;
        }
        // Skip current track and start next
        // Note: player.stop() emits trackEnd with reason='stopped', but mayStartNext['stopped'] = false
        // so the trackEnd event is NOT emitted to the handler. We must manually advance the queue.
        // Pass force=true to bypass loop logic (e.g., song loop)
        this.logSessionEvent(
            'SKIP',
            actor,
            this.queue.current
                ? `[${this.queue.current.info.title}](${this.queue.current.info.uri})`
                : null,
        );
        await this.queue.skip();
        await this.queue.start(true);
        return PlayerResponse.Success;
    }

    /**
     * Skip to a specific position in the queue.
     * @param position - The position to skip to.
     * @param actor - The user who triggered the change.
     * @param showArtist - Whether to include the artist name in the session log.
     * @returns Whether the player was skipped to the position.
     */
    async skipToQueuedTrack(
        position: number,
        actor?: { id: string; tag: string } | string | null,
        showArtist = false,
    ): Promise<PlayerResponse> {
        if (this.restartReady) return PlayerResponse.RestartInProgress;
        if (this.memory.isAdPlaying) return PlayerResponse.AdPlaying;
        const targetTrack = this.queue.tracks[position - 1];
        if (this.queue.tracks.length > 1) {
            const moveResponse = await this.moveQueuedTrack(position, 1, actor, showArtist);
            if (moveResponse !== PlayerResponse.Success) {
                return moveResponse;
            }
        }
        this.logSessionEvent(
            'SKIPTO',
            actor,
            targetTrack
                ? getTrackMarkdownLocaleString(targetTrack, showArtist)
                : null,
        );
        const skipResponse = await this.skipCurrentTrack(actor);
        if (skipResponse !== PlayerResponse.Success) {
            return skipResponse;
        }
        return PlayerResponse.Success;
    }

    /**
     * Stop (and reset) the player.
     * @returns Whether the player was stopped.
     */
    async reset(
        actor?: { id: string; tag: string } | string | null,
    ): Promise<PlayerResponse> {
        if (this.memory.isAdPlaying) return PlayerResponse.AdPlaying;
        if (!this.queue.current || (!this.playing && !this.paused)) {
            return PlayerResponse.PlayerIdle;
        }
        const guild = await QuaverGuild.wrap(this.guild);
        this.logSessionEvent('STOP', actor);
        this.queue.clear();
        this.queue.previous = [];
        delete this.memory.originalQueue;
        delete this.memory.shuffledQueue;
        // Skip current track - trackEnd handler will see the queue is empty
        await this.queue.skip();
        // Manually advance queue to nullify current and emit finish event
        // Force=true bypasses loop logic to prevent re-queuing during stop
        await this.queue.next(true);
        guild.sendWebUpdate('queueUpdate', []);
        return PlayerResponse.Success;
    }

    /**
     * Set the volume of the player.
     * @param volume - The volume to set the player to.
     * @param actor - The user who triggered the change.
     * @returns Whether the volume was set.
     */
    async setVolumeTo(
        volume: number,
        actor?: { id: string; tag: string } | string | null,
    ): Promise<PlayerResponse> {
        const guild = await QuaverGuild.wrap(this.guild);
        if (volume < 0 || volume > 200) {
            return PlayerResponse.InputOutOfRange;
        }
        await this.setVolume(volume);
        this.logSessionEvent('VOLUME', actor, volume.toString());
        guild.sendWebUpdate('volumeUpdate', volume);
        return PlayerResponse.Success;
    }

    /**
     * Decorate the queue with requester info.
     * @returns The decorated queue.
     */
    decorateQueue(): QuaverSong[] {
        return this.queue.tracks.map((t): QuaverSong => {
            const user = this.client.users.cache.get(t.requesterId);
            return {
                ...t,
                requesterTag: user?.tag,
                requesterAvatar: user?.avatar,
            };
        });
    }

    /**
     * Check if a track is an advertisement.
     * @param track - The track to check.
     * @returns Whether the track is an ad.
     */
    isAdTrack(track: QuaverSong): boolean {
        return track.isAd === true;
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
                current: this.queue.current && !this.isAdTrack(this.queue.current)
                    ? this.queue.current
                    : null,
                tracks: this.queue.tracks.filter((track): boolean => !this.isAdTrack(track)),
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
                adPlaytimeMs: this.memory.adPlaytimeMs,
                preAdPlaytimeMs: this.memory.preAdPlaytimeMs,
                isAdPlaying: this.memory.isAdPlaying,
                savedFilters: this.memory.savedFilters
                    ? {
                          bassboost: this.memory.savedFilters.bassboost,
                          nightcore: this.memory.savedFilters.nightcore,
                      }
                    : undefined,
                trackStartTime: this.memory.trackStartTime,
                currentNowPlayingMessageId: this.memory.currentNowPlayingMessageId,
            },
            sessionLogs: [...this.sessionLogs],
        };
    }
}
