export default {
	DISCONNECT: {
		INACTIVITY: {
			DISCONNECTED: 'Nadiskonek tungod kay walay buhat.',
			WARNING: 'Mo guwas ko <t:%1:R>.'
		},
		ALONE: {
			DISCONNECTED: {
				DEFAULT: 'Nadiskonek kay nihawa man tanan.',
				MOVED: 'Nadiskonek kay walay tawo sa target nga channel.'
			},
			WARNING: 'Walay tawo diri.',
			REJOIN_TO_RESUME: 'Balik anhi para mapadayon ang imong session.',
			RESUMING: 'Nagpadayon sa imong session.'
		}
	},
	SESSION_ENDED: {
		FORCED: {
			DISCONNECTED: 'Nahuman ang session kay gidiskonek ko.',
			STAGE_NOT_MODERATOR: 'Nahuman ang session kay gibalhin ko sa stage channel nga dili ko stage moderator.'
		}
	},
	PLAYER: {
		FILTER_NOTE: 'Mahimong molungtad kini og pipila ka segundo aron ma-apply',
		TRACK_SKIPPED_ERROR: 'Gilaktawan [**%1**](%2) kay naay sayop nga nahitabo: `%3`',
		QUEUE_CLEARED_ERROR: 'Gi-clear ang queue isip usa ka sayup nga nahitabo nga daghang beses nga sunud-sunod.',
		LOOP_TRACK_DISABLED: 'Gi-disable ang pag-loop tungod ang track kay ubos pa sa 15 ka segundos nga gitas-on.',
		LOOP_QUEUE_DISABLED: 'Gi-disable ang pag-loop tungod ang track kay ubos pa sa 15 ka segundos nga gitas-on.',
		PLAYING: {
			NOTHING: 'Wala nay nagpatugtog karon.',
			NOW: {
				SIMPLE: 'Nagpatugtog karon og [**%1**](%2) `[%3]`',
				DETAILED: {
					TITLE: 'Nagpatugtog karon',
					DURATION: 'Gidugayon',
					UPLOADER: 'Nag-upload',
					ADDED_BY: 'Gidugang ni',
					REMAINING: 'Nahibilin: %1'
				}
			}
		},
		RESTARTING: {
			DEFAULT: 'Si Quaver kay nagsugod pag-usab ug madiskonekta.',
			CRASHED: 'Si Quaver kay nagcrash ug madiskonekta.',
			QUEUE_DATA_ATTACHED: 'Ang data sa imohang queue kay nakalakip.',
			APOLOGY: 'Pasensya sa kahasol nga gipahinabo.'
		}
	},
	QUEUE: {
		EMPTY: 'Wala nay nahibilin sa queue.',
		TRACK_ADDED: {
			SINGLE: {
				DEFAULT: 'Gidugang ang [**%1**](%2) sa queue',
				INSERTED: 'Gidugang ang [**%1**](%2) sa unahan sa queue'
			},
			MULTIPLE: {
				DEFAULT: 'Midugang og **%1** ka mga track gikan sa [**%2**](%3) sa queue',
				INSERTED: 'Midugang og **%1** tracks gikan sa [**%2**](%3) sa unahan sa queue'
			}
		}
	}
};