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
    Success,
}

export type PlayerStatesRecord = Record<string, QuaverPlayerJSON> & {
    savedAt?: number;
    attempts?: number;
};
