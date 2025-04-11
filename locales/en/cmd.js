export default {
    '247': {
        DESCRIPTION: '24/7 mode prevents Quaver from leaving.',
        OPTION: {
            ENABLED: 'Whether or not 24/7 mode is enabled. If not specified, it will be toggled.',
        },
        RESPONSE: {
            ENABLED: '24/7 **enabled**',
            DISABLED: '24/7 **disabled**',
            QUEUE_CHANNEL_MISSING: 'The queue channel is missing. Try using </bind:%1>.',
        },
        MISC: {
            NOTE: 'Quaver will use the same voice and text channels if it restarts.',
        },
    },
    BASSBOOST: {
        DESCRIPTION: 'Bass boost mode amplifies the bass levels.',
        OPTION: {
            ENABLED: 'Whether or not bass boost mode is enabled. If not specified, it will be toggled.',
        },
        RESPONSE: {
            ENABLED: 'Bass boost **enabled**',
            DISABLED: 'Bass boost **disabled**',
        },
    },
    BIND: {
        DESCRIPTION: 'Change the channel used by Quaver to send messages automatically.',
        OPTION: {
            NEW_CHANNEL: 'The channel to bind to.',
        },
        RESPONSE: {
            SUCCESS: 'Bound to <#%1>',
            PERMISSIONS_INSUFFICIENT: 'I do not have sufficient permission(s) in <#%1>.',
        },
    },
    CLEAR: {
        DESCRIPTION: 'Clear the queue.',
        RESPONSE: {
            SUCCESS: 'The queue has been cleared.',
            QUEUE_EMPTY: 'There are no tracks in the queue to clear.',
            CONFIRMATION: 'Are you sure you want to clear the queue?',
        },
    },
    DISCONNECT: {
        DESCRIPTION: 'Disconnect Quaver.',
        RESPONSE: {
            SUCCESS: 'Left the voice channel.',
            FEATURE_247_ENABLED: 'Quaver is unable to leave as 24/7 is enabled.',
            CONFIRMATION: 'Are you sure you want Quaver to disconnect? This will also clear the queue.',
        },
    },
    INFO: {
        DESCRIPTION: 'Show information about Quaver.',
        RESPONSE: {
            SUCCESS: 'Open-source music bot for small communities.\nRunning version `%1`.',
            MENTION: 'Hi! Quaver uses [Slash Commands](https://support-apps.discord.com/hc/en-us/articles/26501837786775-Slash-Commands-FAQ).\nFor more information about Quaver, use </info:%1>.\nTo play a track, try </play:%2> or </search:%3>.\nTo configure Quaver, use </settings:%4>.',
        },
        MISC: {
            SOURCE_CODE: 'Source Code',
            INVITE: 'Invite',
            SUPPORT_SERVER: 'Support Server',
            SPONSOR_US: 'Sponsor Us',
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
            NO_RESULTS: 'No results for that query were found.',
        },
        MISC: {
            ROMANIZE_FROM_KOREAN: 'Romanize from Korean',
            ROMANIZE_FROM_JAPANESE: 'Romanize from Japanese',
            ROMANIZE_FROM_CHINESE: 'Romanize from Chinese',
            JAPANESE_INACCURATE: 'Romanizing kanji might result in slight inaccuracies.',
        },
    },
    MOVE: {
        DESCRIPTION: 'Move a track within the queue.',
        OPTION: {
            OLD_POSITION: 'The position of the track to move.',
            NEW_POSITION: 'The new position of the track.',
        },
        RESPONSE: {
            SUCCESS: 'Moved [**%1**](%2) `%3 -> %4`',
            QUEUE_INSUFFICIENT_TRACKS: 'There aren\'t enough tracks in the queue to perform a move.',
            OUT_OF_RANGE: 'Your input was invalid.',
            MOVING_IN_PLACE: 'You can\'t move a track to the same position it is already in.',
        },
    },
    NIGHTCORE: {
        DESCRIPTION: 'Nightcore mode speeds up your music.',
        OPTION: {
            ENABLED: 'Whether or not nightcore mode is enabled. If not specified, it will be toggled.',
        },
        RESPONSE: {
            ENABLED: 'Nightcore **enabled**',
            DISABLED: 'Nightcore **disabled**',
        },
    },
    PAUSE: {
        DESCRIPTION: 'Pause Quaver.',
        RESPONSE: {
            SUCCESS: 'The player has been paused.',
            STATE_UNCHANGED: 'The player is already paused.',
        },
    },
    PING: {
        DESCRIPTION: 'Show Quaver\'s latency and uptime.',
        RESPONSE: {
            SUCCESS: 'Pong!%1',
        },
        MISC: {
            UPTIME: 'Uptime:',
        },
    },
    PLAY: {
        DESCRIPTION: 'Add a track to the queue.',
        OPTION: {
            QUERY: 'Your search query or a link.',
            INSERT: 'Whether or not to play the track next.',
        },
        RESPONSE: {
            NO_RESULTS: 'Found no results from your query.',
            LOAD_FAILED: 'Failed to load the track.',
        },
    },
    PLAYING: {
        DESCRIPTION: 'Show what\'s currently playing.',
    },
    QUEUE: {
        DESCRIPTION: 'Show the queue.',
        RESPONSE: {
            QUEUE_EMPTY: 'There is nothing coming up.',
            OUT_OF_RANGE: 'Your input was invalid.',
        },
        MISC: {
            PAGE: 'Page',
            MODAL_TITLE: 'Go to page',
        },
    },
    REMOVE: {
        DESCRIPTION: 'Remove a track from the queue.',
        OPTION: {
            POSITION: 'The position of the track to remove.',
        },
        RESPONSE: {
            SUCCESS: {
                DEFAULT: 'Removed [**%1**](%2)',
                FORCED: 'Removed [**%1**](%2) by force',
                MANAGER: 'Removed [**%1**](%2) by manager bypass',
            },
            QUEUE_EMPTY: 'There are no tracks in the queue to remove.',
        },
    },
    RESUME: {
        DESCRIPTION: 'Resume Quaver.',
        RESPONSE: {
            SUCCESS: 'The player has been resumed.',
            STATE_UNCHANGED: 'The player is already playing.',
        },
    },
    SEARCH: {
        DESCRIPTION: 'Search for a track.',
        OPTION: {
            QUERY: 'Your search query.',
        },
        RESPONSE: {
            USE_PLAY_CMD: 'Try using </play:%1> instead.',
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
            SUCCESS: {
                DEFAULT: 'Seeking to `[%1 / %2]`',
                FORCED: 'Seeking to `[%1 / %2]` by force',
                MANAGER: 'Seeking to `[%1 / %2]` by manager bypass',
            },
            TIMESTAMP_MISSING: 'Please specify a timestamp to seek to.',
            TIMESTAMP_INVALID: 'The timestamp provided exceeds the track\'s duration of `%1`.',
            STREAM_CANNOT_SEEK: 'Seek cannot be used for streams.',
        },
    },
    SETTINGS: {
        DESCRIPTION: 'Change Quaver\'s settings in this server.',
        RESPONSE: {
            HEADER: 'Settings for **%1**',
        },
        MISC: {
            PREMIUM: {
                NAME: 'Premium',
                DESCRIPTION: 'Premium features for this server.',
                FEATURES: {
                    STAY: '24/7 Mode',
                    AUTOLYRICS: 'Auto Lyrics',
                    SMARTQUEUE: 'Smart Queue',
                },
                DISPLAY: {
                    UNLOCKED: {
                        PERMANENT: 'Available **forever**',
                        TEMPORARY: 'Available until **<t:%1:f>**',
                    },
                    LOCKED: {
                        DEFAULT: 'Requires Premium',
                        EXPIRED: 'Expired at **<t:%1:f>**',
                    },
                },
            },
            LANGUAGE: {
                NAME: 'Language',
                DESCRIPTION: 'The language to use for this server.',
            },
            NOTIFYIN247: {
                NAME: 'Notify in 24/7 mode',
                DESCRIPTION: 'Whether or not to send "Now playing" messages in 24/7 mode.',
            },
            FORMAT: {
                NAME: 'Format',
                DESCRIPTION: 'The "Now playing" format to use for this server.',
                EXAMPLE: {
                    SIMPLE: 'Simple Format Display',
                    DETAILED: 'Detailed Format Display',
                },
                OPTIONS: {
                    SIMPLE: 'Simple',
                    DETAILED: 'Detailed',
                },
            },
            DJ: {
                NAME: 'DJ Role',
                DESCRIPTION: 'A role allowing requester check bypass.',
            },
            SOURCE: {
                NAME: 'Source',
                DESCRIPTION: 'The default source to use. Affects the /play command.',
            },
            AUTOLYRICS: {
                NAME: 'Auto Lyrics',
                DESCRIPTION: 'Automatically send lyrics for every track.',
            },
            SMARTQUEUE: {
                NAME: 'Smart Queue',
                DESCRIPTION: 'Sorts the queue to alternate between requesters.',
            },
        },
    },
    SHUFFLE: {
        DESCRIPTION: 'Shuffle the queue.',
        RESPONSE: {
            SUCCESS: 'Shuffled the queue.',
            QUEUE_INSUFFICIENT_TRACKS: 'There aren\'t enough tracks in the queue to perform a shuffle.',
        },
    },
    SKIP: {
        DESCRIPTION: 'Skip the current track.',
        RESPONSE: {
            SUCCESS: {
                DEFAULT: 'Skipped [**%1**](%2)',
                VOTED: 'Skipped [**%1**](%2) by voting',
                FORCED: 'Skipped [**%1**](%2) by force',
                MANAGER: 'Skipped [**%1**](%2) by manager bypass',
            },
            VOTED: {
                SUCCESS: 'Voted to skip [**%1**](%2) `[%3 / %4]`',
                STATE_UNCHANGED: 'You have already voted to skip this track.',
            },
        },
    },
    STOP: {
        DESCRIPTION: 'Stop the current track and clear the queue.',
        RESPONSE: {
            SUCCESS: 'Stopped the current track and cleared the queue.',
            CONFIRMATION: 'Are you sure you want to stop the current track and clear the queue?',
        },
    },
    VOLUME: {
        DESCRIPTION: 'Adjust the volume of Quaver.',
        OPTION: {
            NEW_VOLUME: 'The new volume to adjust to.',
        },
        RESPONSE: {
            SUCCESS: 'Volume adjusted to `%1%`',
            OUT_OF_RANGE: 'That is not within the valid range of `0%` to `200%`.',
        },
    },
};
