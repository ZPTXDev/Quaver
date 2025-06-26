export default {
    CHANNEL_UNSUPPORTED: 'The channel you\'re in is currently an unsupported channel type. Sorry!',
    GENERIC_ERROR: 'There was an error while processing your request.',
    INSUFFICIENT_PERMISSIONS: {
        BOT: {
            BASIC: 'Quaver needs the **Connect** and **Speak** permissions in the voice channel.',
            DEFAULT: 'Quaver is missing permission(s): %1',
            STAGE: 'Quaver needs to be a **Stage Moderator** of the stage channel.',
            TIMED_OUT: 'Quaver is currently timed out.',
            VIEW: 'Quaver needs the **View Channel** and **Send Messages** permissions in this channel.',
        },
        USER: 'You are missing permission(s): %1',
    },
    INTERACTION: {
        CANCELED: 'This interaction was canceled by <@%1>.',
        EXPIRED: 'This interaction has expired.',
    },
};
