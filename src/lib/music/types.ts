import type { QuaverPlayerJSON } from '#src/lib/music/QuaverPlayer';

export enum PlayerResponse {
    RestartInProgress,
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
    AdPlaying,
    Success,
}

export type PlayerStatesRecord = Record<string, QuaverPlayerJSON> & {
    savedAt?: number;
    attempts?: number;
    lavalinkSessionId?: string;
};

// Re-export queue types
export { LoopType, QuaverQueue } from './QuaverQueue';
export type { QueueLoop, QuaverQueueJSON, AddOptions } from './QuaverQueue';
