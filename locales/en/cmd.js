export default {
    '247': {
        DESCRIPTION: '24/7 mode prevents Quaver from leaving.',
        OPTION: {
            ENABLED: 'Whether or not 24/7 mode is enabled. If not specified, it will be toggled.',
        },
        RESPONSE: {
            DISABLED: '24/7 mode has been **disabled**',
            ENABLED: '24/7 mode has been **enabled**',
            QUEUE_CHANNEL_MISSING: 'The queue channel is missing. Try using </bind:%1>.',
        },
        MISC: {
            NOTE: '-# Quaver will use the current voice and text channel if it restarts.',
        },
    },
    BASSBOOST: {
        DESCRIPTION: 'Bass boost mode amplifies the bass levels.',
        OPTION: {
            ENABLED: 'Whether or not bass boost mode is enabled. If not specified, it will be toggled.',
        },
        RESPONSE: {
            DISABLED: 'Bass boost mode has been **disabled**',
            ENABLED: 'Bass boost mode has been **enabled**',
        },
    },
    BIND: {
        DESCRIPTION: 'Change the channel used by Quaver to send messages automatically.',
        OPTION: {
            NEW_CHANNEL: 'The channel to bind to.',
        },
        RESPONSE: {
            PERMISSIONS_INSUFFICIENT: 'Quaver does not have sufficient permission(s) in <#%1>.',
            SUCCESS: 'Quaver will send new "Now playing" messages to <#%1>',
        },
    },
    CLEAR: {
        DESCRIPTION: 'Clear the queue.',
        RESPONSE: {
            CONFIRMATION: 'Are you sure you want to clear the queue?',
            QUEUE_EMPTY: 'There are no tracks in the queue to clear.',
            SUCCESS: 'The queue has been cleared.',
        },
    },
    DISCONNECT: {
        DESCRIPTION: 'Disconnect Quaver.',
        RESPONSE: {
            CONFIRMATION: 'Are you sure you want Quaver to disconnect? You will also lose your current queue.',
            FEATURE_247_ENABLED: 'Quaver is unable to disconnect as 24/7 mode is enabled.',
            SUCCESS: 'Disconnected from the voice channel.',
        },
    },
    INFO: {
        DESCRIPTION: 'Show information about Quaver.',
        RESPONSE: {
            MENTION: 'Hi! Quaver uses [Slash Commands](https://support-apps.discord.com/hc/en-us/articles/26501837786775-Slash-Commands-FAQ).\nFor more information about Quaver, use </info:%1>.\nTo play a track, try </play:%2> or </search:%3>.\nTo configure Quaver, use </settings:%4>.',
            SUCCESS: 'Open-source music bot for small communities.\nMade with ❤️ by **ZPTX**.\nRunning version `%1`.',
        },
        MISC: {
            INVITE: 'Invite',
            SOURCE_CODE: 'Source Code',
            SPONSOR_US: 'Sponsor Us',
            SUPPORT_SERVER: 'Support Server',
            TRANSLATE_FOR_US: 'Translate for Us',
        },
    },
    LOOP: {
        DESCRIPTION: 'Change the looping mode.',
        OPTION: {
            TYPE: {
                DESCRIPTION: 'The looping mode.',
                OPTION: {
                    DISABLED: 'Disabled',
                    TRACK: 'Track',
                    QUEUE: 'Queue',
                },
            },
        },
        RESPONSE: {
            SUCCESS: 'Looping mode set to **%1**',
        },
    },
    LYRICS: {
        DESCRIPTION: 'Look up lyrics.',
        OPTION: {
            QUERY: 'Search query. If not specified, uses the currently playing track.',
        },
        RESPONSE: {
            NO_QUERY: 'No search query was specified.',
            NO_RESULTS: 'Your search yielded no results.',
            ROMANIZATION_FAILED: 'An internal error occurred. Please try again later.',
        },
        MISC: {
            JAPANESE_INACCURATE: '-# Romanizing kanji might result in slight inaccuracies.',
            ROMANIZE_FROM_CHINESE: 'Romanize from Chinese',
            ROMANIZE_FROM_JAPANESE: 'Romanize from Japanese',
            ROMANIZE_FROM_KOREAN: 'Romanize from Korean',
        },
    },
    MOVE: {
        DESCRIPTION: 'Move a track within the queue.',
        OPTION: {
            NEW_POSITION: 'The new position of the track.',
            OLD_POSITION: 'The position of the track to move.',
        },
        RESPONSE: {
            MOVING_IN_PLACE: 'You can\'t move a track to the same position it is already in.',
            OUT_OF_RANGE: 'Your input was out of range.',
            QUEUE_INSUFFICIENT_TRACKS: 'There aren\'t enough tracks in the queue to perform a move.',
            SUCCESS: 'Moved **%1** `%2 -> %3`',
        },
    },
    NIGHTCORE: {
        DESCRIPTION: 'Nightcore mode speeds up your music.',
        OPTION: {
            ENABLED: 'Whether or not nightcore mode is enabled. If not specified, it will be toggled.',
        },
        RESPONSE: {
            DISABLED: 'Nightcore mode has been **disabled**',
            ENABLED: 'Nightcore mode has been **enabled**',
        },
    },
    PAUSE: {
        DESCRIPTION: 'Pause Quaver.',
        RESPONSE: {
            STATE_UNCHANGED: 'The player is already paused.',
            SUCCESS: 'The player has been paused.',
        },
    },
    PING: {
        DESCRIPTION: 'Show Quaver\'s latency and uptime.',
        RESPONSE: {
            SUCCESS: 'Pong! Heartbeat: %1',
        },
        MISC: {
            UPTIME: '-# Uptime: %1',
        },
    },
    PLAY: {
        DESCRIPTION: 'Add a track to the queue.',
        OPTION: {
            INSERT: 'Whether or not to play the track next.',
            QUERY: 'Your search query or a link.',
        },
        RESPONSE: {
            LOAD_FAILED: 'An internal error prevented the track(s) from loading. Please try again later.',
            NO_RESULTS: 'Your search yielded no results.',
        },
    },
    PLAYING: {
        DESCRIPTION: 'Show what\'s currently playing.',
    },
    QUEUE: {
        DESCRIPTION: 'Show the queue.',
        RESPONSE: {
            OUT_OF_RANGE: 'Your input was invalid.',
            QUEUE_EMPTY: 'There is nothing coming up.',
        },
        MISC: {
            MODAL_TITLE: 'Go to page',
            PAGE: 'Page',
        },
    },
    REMOVE: {
        DESCRIPTION: 'Remove a track from the queue.',
        OPTION: {
            POSITION: 'The position of the track to remove.',
        },
        RESPONSE: {
            QUEUE_EMPTY: 'The queue is empty.',
            SUCCESS: {
                DEFAULT: 'Removed **%1**',
                FORCED: 'Removed **%1** by force',
                MANAGER: 'Removed **%1** by manager bypass',
            },
        },
    },
    RESUME: {
        DESCRIPTION: 'Resume Quaver.',
        RESPONSE: {
            STATE_UNCHANGED: 'The player is already playing.',
            SUCCESS: 'The player has been resumed.',
        },
    },
    SEARCH: {
        DESCRIPTION: 'Search for a track.',
        OPTION: {
            QUERY: 'Your search query.',
        },
        RESPONSE: {
            LOAD_FAILED: 'An internal error prevented the track(s) from loading. Please try again later.',
            USE_PLAY_CMD: 'Your search failed due to an internal error. Please try using </play:%1> for this query instead, or try again later.',
        },
        MISC: {
            PICK: 'Pick track(s)',
        },
    },
    SEEK: {
        DESCRIPTION: 'Seek to a specific time in the current track.',
        OPTION: {
            HOURS: 'The hours position for the target timestamp.',
            MINUTES: 'The minutes position for the target timestamp.',
            SECONDS: 'The seconds position for the target timestamp.',
        },
        RESPONSE: {
            STREAM_CANNOT_SEEK: 'Seek cannot be used for streams.',
            SUCCESS: {
                DEFAULT: 'Seeking to `[%1 / %2]`',
                FORCED: 'Seeking to `[%1 / %2]` by force',
                MANAGER: 'Seeking to `[%1 / %2]` by manager bypass',
            },
            TIMESTAMP_INVALID: 'The timestamp provided exceeds the track\'s duration of `%1`.',
            TIMESTAMP_MISSING: 'Please specify a timestamp to seek to.',
        },
    },
    SETTINGS: {
        DESCRIPTION: 'Change Quaver\'s settings in this server.',
        RESPONSE: {
            HEADER: 'Settings for **%1**',
        },
        MISC: {
            AUTOLYRICS: {
                DESCRIPTION: 'Automatically send lyrics for every track.',
                NAME: 'Auto Lyrics',
            },
            DJ: {
                DESCRIPTION: 'A role allowing requester check bypass.',
                NAME: 'DJ Role',
            },
            FORMAT: {
                DESCRIPTION: 'The "Now playing" format to use for this server.',
                EXAMPLE: {
                    DETAILED: 'Detailed Format Display',
                    SIMPLE: 'Simple Format Display',
                },
                NAME: 'Format',
                OPTIONS: {
                    DETAILED: 'Detailed',
                    SIMPLE: 'Simple',
                },
            },
            LANGUAGE: {
                DESCRIPTION: 'The language to use for this server.',
                NAME: 'Language',
            },
            NOTIFYIN247: {
                DESCRIPTION: 'Whether or not to send "Now playing" messages in 24/7 mode.',
                NAME: 'Notify in 24/7 mode',
            },
            PREMIUM: {
                DESCRIPTION: 'Premium features for this server.',
                DISPLAY: {
                    LOCKED: {
                        DEFAULT: 'Requires Premium',
                        EXPIRED: 'Expired at **<t:%1:f>**',
                    },
                    UNLOCKED: {
                        PERMANENT: 'Available **forever**',
                        TEMPORARY: 'Available until **<t:%1:f>**',
                    },
                },
                FEATURES: {
                    AUTOLYRICS: 'Auto Lyrics',
                    SMARTQUEUE: 'Smart Queue',
                    STAY: '24/7 Mode',
                },
                NAME: 'Premium',
            },
            SMARTQUEUE: {
                DESCRIPTION: 'Sorts the queue to alternate between requesters.',
                NAME: 'Smart Queue',
            },
            SOURCE: {
                DESCRIPTION: 'The default source to use. Affects the /play command.',
                NAME: 'Source',
            },
        },
    },
    SHUFFLE: {
        DESCRIPTION: 'Shuffle the queue.',
        RESPONSE: {
            QUEUE_INSUFFICIENT_TRACKS: 'There aren\'t enough tracks in the queue to perform a shuffle.',
            SUCCESS: 'Shuffled the queue.',
        },
    },
    SKIP: {
        DESCRIPTION: 'Skip the current track.',
        RESPONSE: {
            VOTED: {
                STATE_UNCHANGED: 'You have already voted to skip this track.',
                SUCCESS: 'Voted to skip %1 `[%2 / %3]`',
            },
            SUCCESS: {
                DEFAULT: 'Skipped **%1**',
                FORCED: 'Skipped **%1** by force',
                MANAGER: 'Skipped **%1** by manager bypass',
                VOTED: 'Skipped **%1** by voting',
            },
        },
    },
    STOP: {
        DESCRIPTION: 'Stop the current track and clear the queue.',
        RESPONSE: {
            CONFIRMATION: 'Are you sure you want to stop the current track and clear the queue?',
            SUCCESS: 'Stopped the current track and cleared the queue.',
        },
    },
    VOLUME: {
        DESCRIPTION: 'Adjust the volume of Quaver.',
        OPTION: {
            NEW_VOLUME: 'The new volume to adjust to.',
        },
        RESPONSE: {
            OUT_OF_RANGE: 'That is not within the valid range of `0%` to `200%`.',
            SUCCESS: 'Volume adjusted to `%1%`',
        },
    },
};
