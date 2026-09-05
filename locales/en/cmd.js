export default {
    '247': {
        DESCRIPTION: '24/7 Mode prevents Quaver from leaving.',
        MISC: {
            NOTE: '-# Quaver will use the current voice and text channel if it restarts.',
        },
        OPTION: {
            ENABLED: 'Whether 24/7 Mode is enabled. If not specified, it will be toggled.',
        },
        RESPONSE: {
            DISABLED: '24/7 Mode has been **disabled**',
            ENABLED: '24/7 Mode has been **enabled**',
            QUEUE_CHANNEL_MISSING: 'The queue channel is missing. Try using </bind:%1>.',
        },
    },
    BASSBOOST: {
        DESCRIPTION: 'Bass boost mode amplifies the bass levels.',
        OPTION: {
            ENABLED: 'Whether bass boost mode is enabled. If not specified, it will be toggled.',
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
        DESCRIPTION: 'Clear tracks from the queue.',
        SUBCOMMAND: {
            ALL: {
                DESCRIPTION: 'Clear all tracks in the queue.',
            },
            MINE: {
                DESCRIPTION: 'Clear only your tracks from the queue.',
            },
        },
        RESPONSE: {
            CONFIRMATION: 'Are you sure you want to clear the queue?',
            CONFIRMATION_ALL: 'Are you sure you want to clear **all tracks** in the queue?',
            CONFIRMATION_MINE: 'Are you sure you want to clear **your tracks** in the queue?',
            NO_USER_TRACKS: 'You have no tracks in the queue to clear.',
            QUEUE_EMPTY: 'There are no tracks in the queue to clear.',
            SUCCESS: 'The queue has been cleared.',
            SUCCESS_MINE: 'Your tracks have been cleared from the queue.',
        },
    },
    DISCONNECT: {
        DESCRIPTION: 'Disconnect Quaver.',
        RESPONSE: {
            CONFIRMATION: 'Are you sure you want Quaver to disconnect? You will also lose your current queue.',
            FEATURE_247_ENABLED: 'Quaver is unable to disconnect as 24/7 Mode is enabled.',
            SUCCESS: 'Disconnected from the voice channel.',
        },
    },
    EXPORTQUEUE: {
        DESCRIPTION: 'Export the queue to a file.',
        RESPONSE: {
            QUEUE_EMPTY: 'There is nothing in the queue to export.',
            SUCCESS: 'Exported **%1** track(s) from the queue.',
        },
    },
    INFO: {
        DESCRIPTION: 'Show information about Quaver.',
        MISC: {
            INVITE: 'Invite',
            SOURCE_CODE: 'Source Code',
            SPONSOR_US: 'Sponsor Us',
            SUPPORT_SERVER: 'Support Server',
            TRANSLATE_FOR_US: 'Translate for Us',
        },
        RESPONSE: {
            MENTION: 'Hi! Quaver uses [Slash Commands](https://support-apps.discord.com/hc/en-us/articles/26501837786775-Slash-Commands-FAQ).\nFor more information about Quaver, use </info:%1>.\nTo play a track, try </play:%2> or </search:%3>.\nTo configure Quaver, use </settings:%4>.',
            SUCCESS: 'Simple-to-use music bot with features such as bass boost, nightcore, seek, search, and more.\nMade with ❤️ by **ZPTX**.\nRunning version `%1`.',
        },
    },
    LOOP: {
        DESCRIPTION: 'Change the looping mode.',
        OPTION: {
            TYPE: {
                DESCRIPTION: 'The looping mode.',
                OPTION: {
                    DISABLED: 'Disabled',
                    QUEUE: 'Queue',
                    TRACK: 'Track',
                },
            },
        },
        RESPONSE: {
            SUCCESS: 'Looping mode set to **%1**',
        },
    },
    LYRICS: {
        DESCRIPTION: 'Look up lyrics.',
        MISC: {
            JAPANESE_INACCURATE: '-# Romanizing kanji might result in slight inaccuracies.',
            ROMANIZE_FROM_CHINESE: 'Romanize from Chinese',
            ROMANIZE_FROM_JAPANESE: 'Romanize from Japanese',
            ROMANIZE_FROM_KOREAN: 'Romanize from Korean',
        },
        OPTION: {
            QUERY: 'Search query. If not specified, uses the currently playing track.',
        },
        RESPONSE: {
            NO_QUERY: 'No search query was specified.',
            NO_RESULTS: 'Your search yielded no results.',
            ROMANIZATION_FAILED: 'An internal error occurred. Please try again later.',
        },
    },
    MOVE: {
        DESCRIPTION: 'Move a track within the queue.',
        OPTION: {
            NEW_POSITION: 'The new position of the track.',
            OLD_POSITION: 'The position of the track to move.',
        },
        RESPONSE: {
            FEATURE_CONFLICT: 'Moving tracks is disabled while **Shuffle** or **Smart Queue** is enabled.',
            MOVING_IN_PLACE: 'You can\'t move a track to the same position it is already in.',
            OUT_OF_RANGE: 'Your input was out of range.',
            QUEUE_INSUFFICIENT_TRACKS: 'There aren\'t enough tracks in the queue to perform a move.',
            SUCCESS: 'Moved **%1** `%2 -> %3`',
        },
    },
    NIGHTCORE: {
        DESCRIPTION: 'Nightcore mode speeds up your music.',
        OPTION: {
            ENABLED: 'Whether nightcore mode is enabled. If not specified, it will be toggled.',
        },
        RESPONSE: {
            DISABLED: 'Nightcore mode has been **disabled**',
            ENABLED: 'Nightcore mode has been **enabled**',
        },
    },
    PAUSE: {
        DESCRIPTION: 'Pause Quaver.',
        RESPONSE: {
            ERROR: {
                AD_PLAYING: 'You cannot pause during ad breaks.',
            },
            STATE_UNCHANGED: 'The player is already paused.',
            SUCCESS: 'The player has been paused.',
        },
    },
    PING: {
        DESCRIPTION: 'Show Quaver\'s latency and uptime.',
        MISC: {
            UPTIME: '-# Uptime: %1',
        },
        RESPONSE: {
            SUCCESS: 'Pong! Heartbeat: %1',
        },
    },
    PLAY: {
        DESCRIPTION: 'Add a track to the queue.',
        OPTION: {
            INSERT: 'Whether to play the track next.',
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
        MISC: {
            MODAL_TITLE: 'Go to page',
            PAGE: 'Page',
        },
        RESPONSE: {
            OUT_OF_RANGE: 'Your input was invalid.',
            QUEUE_EMPTY: 'There is nothing coming up.',
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
            ERROR: {
                AD_PLAYING: 'You cannot resume during ad breaks.',
            },
            STATE_UNCHANGED: 'The player is already playing.',
            SUCCESS: 'The player has been resumed.',
        },
    },
    SEARCH: {
        DESCRIPTION: 'Search for a track.',
        MISC: {
            PICK: 'Pick track(s)',
        },
        OPTION: {
            QUERY: 'Your search query.',
        },
        RESPONSE: {
            LOAD_FAILED: 'An internal error prevented the track(s) from loading. Please try again later.',
            NO_RESULTS: 'Your search yielded no results.',
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
            ERROR: {
                AD_PLAYING: 'You cannot seek during ad breaks.',
            },
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
    SESSIONLOGS: {
        DESCRIPTION: 'Show logs of the current playback session.',
        MISC: {
            DISABLED: 'disabled',
            ENABLED: 'enabled',
            EVENT: {
                BASSBOOST: '**%1** **%2** bass boost mode',
                BIND: '**%1** bound the text channel to <#%2>',
                DISCONNECT: '**%1** disconnected the player',
                LOOP: '**%1** set loop mode to **%2**',
                NIGHTCORE: '**%1** **%2** nightcore mode',
                PAUSE: '**%1** paused the player',
                PLAY: 'Started playing **%2**',
                QUEUE_ADD: '**%1** added **%2**',
                QUEUE_CLEAR: '**%1** cleared the queue',
                QUEUE_FINISH: 'Queue finished',
                QUEUE_MOVE: '**%1** moved **%2**',
                QUEUE_REMOVE: '**%1** removed **%2**',
                RESUME: '**%1** resumed the player',
                SEEK: '**%1** seeked to **%2**',
                SHUFFLE: '**%1** **%2** shuffle',
                SKIP: '**%1** skipped **%2**',
                SKIPTO: '**%1** skipped to **%2**',
                SMARTQUEUE: '**%1** **%2** Smart Queue',
                STAY: '**%1** **%2** 24/7 Mode',
                STOP: '**%1** stopped the player',
                VOLUME: '**%1** set the volume to **%2%**',
            },
        },
        RESPONSE: {
            NO_LOGS: 'There are no logs for the current session.',
        },
    },
    SETTINGS: {
        DESCRIPTION: 'Change Quaver\'s settings in this server.',
        MISC: {
            CONTENT: {
                DESCRIPTION: 'Customize how information and lyrics are presented in your text channels.',
                NAME: 'Content & Display',
                SETTINGS: {
                    AUTOLYRICS: {
                        DESCRIPTION: 'Automatically send lyrics for every track.',
                        NAME: 'Auto Lyrics',
                    },
                    CONTROLS: {
                        DESCRIPTION: 'Whether to show player control buttons on "Now playing" messages.',
                        NAME: 'Player Controls',
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
                    SHOWARTIST: {
                        DESCRIPTION: 'Whether to show the artist name on all messages.',
                        NAME: 'Show Artist Name',
                    },
                    SHOWSOURCELABELS: {
                        DESCRIPTION: 'Whether to show track sources on "Now playing" messages, /playing, /play, /search, and /queue commands.',
                        NAME: 'Show Source Labels',
                    },
                },
            },
            GENERAL: {
                DESCRIPTION: 'Manage the core identity and permission levels for Quaver on this server.',
                NAME: 'General & Access',
                SETTINGS: {
                    DJ: {
                        DESCRIPTION: 'A role allowing requester check bypass.',
                        NAME: 'DJ Role',
                    },
                    LANGUAGE: {
                        DESCRIPTION: 'The language to use for this server.',
                        NAME: 'Language',
                    },
                    PREMIUM: {
                        DESCRIPTION: '**Quaver Premium** unlocks **Ad-Free Listening**, **Auto Lyrics**, **Smart Queue**, and **24/7 Mode**.',
                        NAME: 'Quaver Premium',
                        STATE: {
                            ACTIVE_LIFETIME_MESSAGE: 'This server has lifetime **Quaver Premium**.\nThank you for your support!',
                            ACTIVE_MESSAGE: 'This server has **Quaver Premium** until **<t:%1:f>**.\nThank you for your support!',
                        },
                    },
                },
            },
            MAIN_MENU: {
                DESCRIPTION: 'Select a category below to view or modify server-specific configurations.',
                HEADER: '## Settings for %1',
                TITLE: 'Settings',
            },
            PLAYBACK: {
                DESCRIPTION: 'Configure how Quaver handles music sources and queueing behavior.',
                NAME: 'Playback & Logic',
                SETTINGS: {
                    NOTIFYIN247: {
                        DESCRIPTION: 'Whether to send "Now playing" messages in 24/7 Mode.',
                        NAME: '24/7 Mode - "Now playing" messages',
                    },
                    PAUSEALONE247: {
                        DESCRIPTION: 'Whether to pause playback when alone in voice channel in 24/7 Mode.',
                        NAME: '24/7 Mode - Pause when alone',
                    },
                    SMARTQUEUE: {
                        DESCRIPTION: 'Sorts the queue to alternate between requesters.',
                        NAME: 'Smart Queue',
                    },
                    SOURCE: {
                        DESCRIPTION: 'The default source to use. Affects the /play and /search commands.',
                        NAME: 'Source',
                    },
                },
            },
        },
    },
    SHUFFLE: {
        DESCRIPTION: 'Shuffle the queue.',
        OPTION: {
            ENABLED: 'Whether shuffle is enabled. If not specified, it will be toggled.',
        },
        RESPONSE: {
            DISABLED: 'Shuffle has been **disabled**',
            ENABLED: 'Shuffle has been **enabled**',
        },
    },
    SKIP: {
        DESCRIPTION: 'Skip the current track.',
        RESPONSE: {
            ERROR: {
                AD_PLAYING: 'You cannot skip ad breaks.',
            },
            SUCCESS: {
                DEFAULT: 'Skipped **%1**',
                FORCED: 'Skipped **%1** by force',
                MANAGER: 'Skipped **%1** by manager bypass',
                VOTED: 'Skipped **%1** by voting',
            },
            VOTED: {
                STATE_UNCHANGED: 'You have already voted to skip this track.',
                SUCCESS: 'Voted to skip %1 `[%2 / %3]`',
            },
        },
    },
    SKIPTO: {
        DESCRIPTION: 'Skip the current track and play a specific track in the queue.',
        OPTION: {
            POSITION: 'The position of the track to skip to.',
        },
        RESPONSE: {
            ERROR: {
                AD_PLAYING: 'You cannot skip ad breaks.',
            },
            FEATURE_CONFLICT: 'Skipping to a specific track is disabled while **Shuffle** or **Smart Queue** is enabled.',
            NOT_REQUESTER: 'You are not the requester of the current track and do not have sufficient permissions to skip it.',
            OUT_OF_RANGE: 'Your input was out of range.',
            SUCCESS: {
                DEFAULT: 'Skipped **%1**\nNow playing **%2**',
                FORCED: 'Skipped **%1** by force\nNow playing **%2**',
                MANAGER: 'Skipped **%1** by manager bypass\nNow playing **%2**',
            },
        },
    },
    STOP: {
        DESCRIPTION: 'Stop the current track and clear the queue.',
        RESPONSE: {
            CONFIRMATION: 'Are you sure you want to stop the current track and clear the queue?',
            ERROR: {
                AD_PLAYING: 'You cannot stop during ad breaks.',
            },
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
