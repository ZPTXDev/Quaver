export default {
	INSUFFICIENT_PERMISSIONS: {
		USER: 'You are missing permission(s): %1',
		BOT: {
			DEFAULT: 'I am missing permission(s): %1',
			VIEW: 'I need the View Channel and Send Messages permissions in this channel.',
			BASIC: 'I need the Connect and Speak permissions in the voice channel.',
			STAGE: 'I need to be a stage moderator in the stage channel.',
			TIMED_OUT: 'I am currently timed out.'
		}
	},
	CHANNEL_UNSUPPORTED: 'I cannot start a session in this channel type.',
	GENERIC_ERROR: 'There was an error while processing your request.',
	INTERACTION: {
		USER_MISMATCH: 'That is not your interaction.',
		CANCELED: 'This interaction was canceled by <@%1>.',
		EXPIRED: 'This interaction has expired.'
	}
};
