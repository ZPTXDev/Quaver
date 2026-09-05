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
        CONNECTION_UNSTABLE: 'Quaver has detected an unstable connection to Discord\'s media server. If you are hearing stuttering / robotic audio or nothing at all, please try changing your [Voice Region](https://support.discord.com/hc/en-us/articles/1500007645701-Voice-Regions-on-Discord-FAQ).',
        FEATURE_DISABLED: {
            SMARTQUEUE: {
                PREMIUM: "**Smart Queue** was disabled as **Quaver Premium** has expired.",
                WHITELIST: "**Smart Queue** was disabled as this server no longer has access to the feature."
            },
        },
        FEATURE_RESTORED: {
            SMARTQUEUE: {
                PREMIUM: "**Smart Queue** has been re-enabled as **Quaver Premium** has been renewed.",
                WHITELIST: "**Smart Queue** has been re-enabled as this server has regained access to the feature."
            },
            STAY: {
                PREMIUM: "**24/7 Mode** has been re-enabled as **Quaver Premium** has been renewed.",
                WHITELIST: "**24/7 Mode** has been re-enabled as this server has regained access to the feature."
            },
        },
        FILTER_NOTE: '-# This may take a few seconds to apply',
        LOOP_QUEUE_DISABLED: 'Disabled looping as the queue is less than 15 seconds long.',
        LOOP_TRACK_DISABLED: 'Disabled looping as the track is less than 15 seconds long.',
        PLAYING: {
            AD: {
                MESSAGE: 'This is a brief ad break.\nFor ad-free listening, get **Quaver Premium**.',
                TITLE: '### Ad Break',
            },
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
            ACTION_BLOCKED: 'Sorry! Quaver is restarting soon and is unable to process your request right now.',
            APOLOGY: '-# Sorry for the inconvenience caused.',
            CRASHED: 'Quaver has crashed and will disconnect briefly.',
            DEFAULT: 'Quaver is restarting and will disconnect briefly.',
            PENDING: 'Pardon the interruption! Quaver is restarting shortly.',
            SESSION_RECOVERY_DISABLED: 'You will need to start a new session after Quaver is back online as session recovery is disabled.',
            SESSION_RECOVERY_EXPLANATION: 'Your session will be restored when Quaver is back online.',
            UPDATE: 'Quaver is restarting for an update and will disconnect briefly.'
        },
        RESTORING: 'Quaver is back online! Restoring your session...',
        TRACK_SKIPPED_ERROR: 'Skipped **%1** as an internal error prevented the track from loading.',
    },
    QUEUE: {
        EMPTY: 'There\'s nothing left in the queue.',
        LARGE_PLAYLIST_PROCESSING: 'Your query contains a large number of tracks and needs additional time to process. Quaver is working on it.',
        SLOW_PROCESSING: 'Your query is taking longer than usual to process. Quaver is working on it.',
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
            PREMIUM_EXPIRED: 'Session ended as **Quaver Premium** has expired.',
            STAGE_NOT_MODERATOR: 'Session ended as Quaver was moved to a stage channel that Quaver isn\'t a stage moderator of.',
            WHITELIST_EXPIRED: 'Session ended as this server no longer has access to **24/7 Mode**.',
        },
    },
};
