export default {
	DISCONNECT: {
		INACTIVITY: {
			DISCONNECTED: 'Nadiskonekta mula sa kawalan ng aktibidad.',
			WARNING: 'Aalis ako <t:%1:R>.'
		},
		ALONE: {
			DISCONNECTED: {
				DEFAULT: 'Nadiskonekta nang umalis ang lahat.',
				MOVED: 'Nadiskonekta dahil walang tao sa target na channel.'
			},
			WARNING: 'Walang tao dito.',
			REJOIN_TO_RESUME: 'Sumali muli upang maipagpatuloy ang iyong session.',
			RESUMING: 'Nagpapatuloy ng iyong session.'
		}
	},
	SESSION_ENDED: {
		FORCED: {
			DISCONNECTED: 'Natapos ang session dahil nadiskonekta ako.',
			STAGE_NOT_MODERATOR: 'Natapos ang session dahil inilipat ako sa isang stage channel na hindi ako stage moderator.'
		}
	},
	PLAYER: {
		FILTER_NOTE: 'Maaaring tumagal ito ng ilang segundo bago mag-apply',
		TRACK_SKIPPED_ERROR: 'Nilaktawan ang **[%1](%2)** dahil may naganap na error: `%3`',
		QUEUE_CLEARED_ERROR: 'Na-clear ang queue bilang isang error na naganap nang maraming beses nang magkakasunod.',
		PLAYING: {
			NOTHING: 'Walang nang nagpatugtug ngayon.',
			NOW: {
				SIMPLE: 'Nagpe-play ngayon ng [**%1**](%2) `[%3]`',
				DETAILED: {
					TITLE: 'Nagpe-play ngayon',
					DURATION: 'Durasyon',
					UPLOADER: 'Taga-upload',
					ADDED_BY: 'Idinagdag ni'
				}
			}
		},
		RESTARTING: {
			DEFAULT: 'Nagre-restart si Quaver at madidiskonekta.',
			CRASHED: 'Si Quaver ay nagcrash at madidiskonekta.',
			QUEUE_DATA_ATTACHED: 'Ang data ng iyong queue ay naka-attach.',
			APOLOGY: 'Paumanhin para sa abalang naidulot.'
		}
	},
	QUEUE: {
		EMPTY: 'Walang nang natira sa queue.',
		TRACK_ADDED: {
			SINGLE: {
				DEFAULT: 'Idinagdag ang [**%1**](%2) sa queue',
				INSERTED: 'Idinagdag ang [**%1**](%2) sa simula ng queue'
			},
			MULTIPLE: {
				DEFAULT: 'Nagdagdag ng **%1** tracks mula sa [**%2**](%3) sa queue',
				INSERTED: 'Nagdagdag ng **%1** tracks mula sa [**%2**](%3) sa simula ng queue'
			}
		}
	}
};