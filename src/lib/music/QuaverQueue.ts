import type { QuaverPlayer } from './QuaverPlayer';
import type { QuaverChannels, QuaverSong } from '#src/lib/util';
import { TypedEmitter } from 'tiny-typed-emitter';
import { mayStartNext, type TrackEndReason } from 'lavalink-protocol';
import type { Queue, Song } from '@lavaclient/plugin-queue';
import { LoopType } from '@lavaclient/plugin-queue';

// Re-export LoopType for use in other modules
export { LoopType };

export interface QueueLoop {
    type: LoopType;
    current: number;
    max: number;
}

export interface QuaverQueueJSON {
    current: QuaverSong | null;
    tracks: QuaverSong[];
    loop: QueueLoop;
    channelId: string;
}

export interface AddOptions {
    /** Add to the start of the queue instead of the end */
    next?: boolean;
    /** Requester information */
    requester?: { id: string };
}


export interface QueueEvents {
    trackStart: (song: QuaverSong) => void;
    trackEnd: (song: QuaverSong, reason: TrackEndReason) => void;
    finish: () => void;
}

/**
 * Custom queue implementation with manual advancement control.
 * Based on @lavaclient/plugin-queue but adapted for Quaver's needs.
 */
export class QuaverQueue extends TypedEmitter<QueueEvents> {
    /** The player this queue belongs to */
    readonly player: QuaverPlayer;

    /** Queue options */
    readonly options: QueueOptions;

    /** Queued tracks */
    tracks: QuaverSong[] = [];

    /** Currently playing track */
    current: QuaverSong | null = null;

    /** Previously played tracks (for queue looping) */
    previous: QuaverSong[] = [];

    /** Loop configuration */
    loop: QueueLoop = { type: LoopType.None, current: 0, max: -1 };

    /** Last played track */
    last: QuaverSong | null = null;

    /** Text channel for messages */
    channel: QuaverChannels | null = null;

    /** Custom data storage */
    data: Record<string, unknown> = {};

    constructor(player: QuaverPlayer, options?: QueueOptions) {
        super();
        this.player = player;
        this.options = options ?? {
            play: async (queue, song): Promise<void> => {
                await queue.player.play(song);
            }
        };

        // Listen to Player events and re-emit them as Queue events
        // This ensures Node events are fired with the queue as the first argument
        player.on('trackStart', (): void => {
            if (!this.current) {
                return;
            }
            // Increment loop counter when replaying the same track
            if (this.loop.type === LoopType.Song && this.current === this.last) {
                this.loop.current++;
            }
            this.emit('trackStart', this.current);
        });

        player.on('trackEnd', async (track, reason): Promise<void> => {
            if (!track) {
                return;
            }
            this.emit('trackEnd', track, reason);
        });
    }

    /**
     * Override emit to also emit events on the Node
     * This is required for the Node event handlers to receive queue events
     */
    override emit<K extends keyof QueueEvents>(
        event: K,
        ...args: Parameters<QueueEvents[K]>
    ): boolean {
        // Map queue events to unique names to avoid conflicts with lavaclient's native events
        const eventMap: Record<string, string> = {
            'trackStart': 'queueTrackStart',
            'trackEnd': 'queueTrackEnd',
            'finish': 'queueFinish',
        };
        
        const nodeEvent = eventMap[event] || event;
        
        // Emit on the Node with the queue as the first argument
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cross-type event emission requires type assertion
        this.player.node.emit(nodeEvent as any, this, ...args);
        
        // Also emit on the queue itself
        return super.emit(event, ...args);
    }

    /**
     * Add tracks to the queue
     * @param tracks QuaverSong or array of tracks to add
     * @param options Add options (next, requester)
     * @returns New queue length
     */
    add(tracks: QuaverSong | QuaverSong[], options: AddOptions = {}): number {
        const trackArray = Array.isArray(tracks) ? tracks : [tracks];

        // Add requester info if provided
        if (options.requester) {
            for (const track of trackArray) {
                track.requesterId = options.requester.id;
            }
        }

        // Add to start or end of queue
        if (options.next) {
            this.tracks.unshift(...trackArray);
        } else {
            this.tracks.push(...trackArray);
        }

        return this.tracks.length;
    }

    /**
     * Start playing the queue
     * @returns True if a track was started, false if queue is empty
     */
    async start(): Promise<boolean> {
        return this.next();
    }

    /**
     * Advance to the next track in the queue
     * @returns True if a track was started, false if queue is empty
     */
    async next(): Promise<boolean> {
        // Handle loop logic
        if (this.current) {
            switch (this.loop.type) {
                case LoopType.Song:
                    // Track loop: replay the same track
                    this.last = this.current;
                    await this.player.play(this.current);
                    return true;

                case LoopType.Queue:
                    // Queue loop: move current to previous
                    this.previous.push(this.current);
                    break;

                case LoopType.None:
                    // No loop: just move on
                    break;
            }
        }

        // If queue is empty but we have previous tracks (queue loop), restore them
        if (!this.tracks.length && this.previous.length) {
            this.tracks = this.previous;
            this.previous = [];
        }

        // Get next track
        const next = this.tracks.shift();
        if (!next) {
            // Queue is empty - reset current and emit finish event
            this.current = null;
            this.emit('finish');
            return false;
        }

        // Update current and play
        this.last = this.current;
        this.current = next;
        await this.player.play(next);
        return true;
    }

    /**
     * Skip the current track
     * This will trigger trackEnd which will call next()
     */
    async skip(): Promise<QuaverSong | null> {
        const skipped = this.current;
        await this.player.stop();
        return skipped;
    }

    /**
     * Clear all tracks from the queue
     */
    clear(): void {
        this.tracks = [];
    }

    /**
     * Remove a track from the queue
     * @param song Song object to remove
     * @returns The removed track, or null if not found
     */
    remove(song: QuaverSong): QuaverSong | null;
    /**
     * Remove a track from the queue
     * @param index Index of track to remove (0-based)
     * @returns The removed track, or null if index is invalid
     */
    remove(index: number): QuaverSong | null;
    remove(songOrIndex: QuaverSong | number): QuaverSong | null {
        if (typeof songOrIndex === 'number') {
            // Remove by index
            const index = songOrIndex;
            if (index < 0 || index >= this.tracks.length) {
                return null;
            }
            return this.tracks.splice(index, 1)[0] ?? null;
        } else {
            // Remove by song object
            const song = songOrIndex;
            const index = this.tracks.findIndex((t): boolean => t.encoded === song.encoded);
            if (index === -1) {
                return null;
            }
            return this.tracks.splice(index, 1)[0] ?? null;
        }
    }

    /**
     * Shuffle the queue using Fisher-Yates algorithm
     */
    shuffle(): void {
        for (let i = this.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
        }
    }

    /**
     * Sort the queue using a predicate function
     * @param predicate Comparison function (optional, defaults to no sorting)
     * @returns The sorted tracks array
     */
    sort(predicate?: (a: QuaverSong, b: QuaverSong) => number): QuaverSong[] {
        if (predicate) {
            this.tracks.sort(predicate);
        }
        return this.tracks;
    }

    /**
     * Set the loop mode
     * @param type Loop type (None, Queue, Track)
     * @param max Maximum loop iterations (-1 for infinite)
     */
    setLoop(type: LoopType, max: number = -1): this {
        this.loop.type = type;
        this.loop.max = max;
        this.loop.current = 0;
        return this;
    }

    /**
     * Set custom data
     * @param key Data key or object to merge
     * @param value Data value (if key is string)
     */
    set(key: string | Record<string, unknown>, value?: unknown): void {
        if (typeof key !== 'string') {
            this.data = key;
            return;
        }
        if (value != null) {
            this.data[key] = value;
        }
    }

    /**
     * Get custom data
     * @param key Data key (optional, returns all data if omitted)
     */
    get<T = unknown>(key?: string): T {
        return (key ? this.data[key] : this.data) as T;
    }

    /**
     * Serialize queue state for persistence
     */
    toJSON(): QuaverQueueJSON {
        return {
            current: this.current,
            tracks: this.tracks,
            loop: { ...this.loop },
            channelId: this.channel?.id ?? '',
        };
    }

    /**
     * Restore queue state from JSON
     */
    fromJSON(data: QuaverQueueJSON): void {
        this.current = data.current;
        this.tracks = data.tracks;
        this.loop = { ...data.loop };
        // Channel will be restored separately by the player manager
    }

    /**
     * Get the total duration of all tracks in the queue
     */
    get duration(): number {
        return this.tracks.reduce((total, track): number => total + (track.info?.length ?? 0), 0);
    }

    /**
     * Check if the queue is empty
     */
    get isEmpty(): boolean {
        return this.tracks.length === 0;
    }

    /**
     * Get the number of tracks in the queue
     */
    get size(): number {
        return this.tracks.length;
    }
}
