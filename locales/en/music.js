export default {
	DISCONNECT: {
		INACTIVITY: {
			DISCONNECTED: 'Disconnected due to inactivity.',
			WARNING: 'I\'ll leave <t:%1:R>.'
		},
		ALONE: {
			DISCONNECTED: {
				DEFAULT: 'Disconnected as everyone left.',
				MOVED: 'Disconnected as there was no one in the target channel.'
			},
			WARNING: 'There\'s nobody here.',
			REJOIN_TO_RESUME: 'Rejoin to resume your session.',
			RESUMING: 'Resuming your session.'
		}
	},
	SESSION_ENDED: {
		FORCED: {
			DISCONNECTED: 'Session ended as I was disconnected.',
			STAGE_NOT_MODERATOR: 'Session ended as I was moved to a stage channel that I was not a stage moderator of.'
		}
	},
	PLAYER: {
		FILTER_NOTE: 'This may take a few seconds to apply',
		TRACK_SKIPPED_ERROR: 'Skipped **[%1](%2)** as an error occurred: `%3`',
		QUEUE_CLEARED_ERROR: 'Cleared queue as an error occurred multiple times consecutively.',
		PLAYING: {
			NOTHING: 'There is nothing playing right now.',
			NOW: 'Now playing [**%1**](%2) `[%3]`'
		},
		RESTARTING: {
			DEFAULT: 'Quaver is restarting and will disconnect.',
			CRASHED: 'Quaver has crashed and will disconnect.',
			QUEUE_DATA_ATTACHED: 'Your queue data has been attached.',
			APOLOGY: 'Sorry for the inconvenience caused.'
		}
	},
	QUEUE: {
		EMPTY: 'There\'s nothing left in the queue.',
		TRACK_ADDED: {
			SINGLE: {
				DEFAULT: 'Added [**%1**](%2) to queue',
				INSERTED: 'Added [**%1**](%2) to start of queue'
			},
			MULTIPLE: {
				DEFAULT: 'Added **%1** tracks from [**%2**](%3) to queue',
				INSERTED: 'Added **%1** tracks from [**%2**](%3) to start of queue'
			}
		}
	}
};
