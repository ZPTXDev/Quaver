export default {
    DISCONNECT: {
        ALONE: {
            DISCONNECTED: {
                DEFAULT: 'Disconnected as everyone left.',
                MOVED: 'Disconnected as there was no one in the target channel.',
            },
            REJOIN_TO_RESUME: '-# Rejoin to resume your session.',
            RESUMING: 'Resuming your session.',
            WARNING: 'There\'s nobody here.',
        },
        INACTIVITY: {
            DISCONNECTED: 'Disconnected due to inactivity.',
            WARNING: 'Quaver will disconnect <t:%1:R>.',
        },
    },
    NOT_READY: 'One moment please! Quaver is still starting up.',
    PLAYER: {
        FILTER_NOTE: '-# This may take a few seconds to apply',
        LOOP_QUEUE_DISABLED: 'Disabled looping as the queue is less than 15 seconds long.',
        LOOP_TRACK_DISABLED: 'Disabled looping as the track is less than 15 seconds long.',
        PLAYING: {
            NOTHING: 'There is nothing playing right now.',
            NOW: {
                DETAILED: {
                    ADDED_BY: 'Added by',
                    DURATION: 'Duration',
                    REMAINING: '-# Remaining: %1',
                    SOURCE: 'Source',
                    TEXT: '**%1** `[%2]`',
                    TITLE: '### Now playing',
                    UPLOADER: 'Uploader',
                },
                SIMPLE: {
                    SOURCE: 'Source',
                    TEXT: 'Now playing **%1** `[%2]`',
                },
            },
        },
        QUEUE_CLEARED_ERROR: 'Cleared queue as an error occurred multiple times consecutively.',
        RESTARTING: {
            APOLOGY: '-# Sorry for the inconvenience caused.',
            CRASHED: 'Quaver has crashed and will disconnect.',
            DEFAULT: 'Quaver is restarting and will disconnect.',
            QUEUE_DATA_ATTACHED: 'Your queue data has been attached.',
        },
        TRACK_SKIPPED_ERROR: 'Skipped **%1** as an internal error prevented the track from loading.',
    },
    QUEUE: {
        EMPTY: 'There\'s nothing left in the queue.',
        TRACK_ADDED: {
            MULTIPLE: {
                DEFAULT: 'Added **%1** tracks from **%2** to queue',
                INSERTED: 'Added **%1** tracks from **%2** to start of queue',
            },
            SINGLE: {
                DEFAULT: 'Added **%1** to queue',
                INSERTED: 'Added **%1** to start of queue',
            },
        },
    },
    SESSION_ENDED: {
        FORCED: {
            DISCONNECTED: 'Session ended as Quaver was disconnected.',
            STAGE_NOT_MODERATOR: 'Session ended as Quaver was moved to a stage channel that Quaver isn\'t a stage moderator of.',
        },
    },
};
