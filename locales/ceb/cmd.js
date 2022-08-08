export default {
	'247': {
		DESCRIPTION: 'Ipabilin si Quaver sa imong channel.',
		OPTION: { ENABLED: 'Kung gi-enable man o sa di ang 24/7, kung wala gipiho, kay matoggle ni.' },
		RESPONSE: {
			ENABLED: 'Ang 24/7 ay **gi-enable**',
			DISABLED: 'Ang 24/7 ay **gi-disable**',
			FEATURE_NOT_WHITELISTED: 'Kini nga server wala gi-whitelist aron mogamit og 24/7.',
			QUEUE_CHANNEL_MISSING: 'Ang queue channel kay nawala. Sulayi gamita ang `bind` nga command.'
		},
		MISC: { NOTE: 'Si Quaver mogamit sa parehas nga mga voice ug text channel kung kini magsugod pag-usab.' }
	},
	BASSBOOST: {
		DESCRIPTION: 'I-boost ang bass levels sa imohang musika.',
		OPTION: { ENABLED: 'Kung gi-enable man o sa di ang bass boost, kung wala gipiho, kay matoggle ni.' },
		RESPONSE: {
			ENABLED: 'Ang bass boost kay **gi-enable**',
			DISABLED: 'Ang bass boost kay **gi-disable**'
		}
	},
	BIND: {
		DESCRIPTION: 'Usban ang text channel na gigamit ni Quaver aron awtomatikong makasend og message.',
		OPTION: { NEW_CHANNEL: 'Ang text channel na i-bind.' },
		RESPONSE: {
			SUCCESS: 'Nakabind sa <#%1>',
			PERMISSIONS_INSUFFICIENT: 'Wala koy igong (mga) permission sa <#%1>.'
		}
	},
	CLEAR: {
		DESCRIPTION: 'I-clear ang queue.',
		RESPONSE: {
			SUCCESS: 'Ang queue kay na-clear.',
			QUEUE_EMPTY: 'Walay mga track sa queue aron ma clear.'
		}
	},
	DISCONNECT: {
		DESCRIPTION: 'Ipadiskonek si Quaver.',
		RESPONSE: {
			SUCCESS: 'Niguwas sa voice channel.',
			FEATURE_247_ENABLED: 'Si Quaver kay dili makabiya tungod kay ang 24/7 kay gi-enable.'
		}
	},
	INFO: {
		DESCRIPTION: 'Ipakita ang impormasyon bahin ni Quaver.',
		RESPONSE: { SUCCESS: 'Open-source nga music bot for para sa ginagmay na mga komunidad.\\nAng source code kay available [dinhi](https://go.zptx.dev/Quaver), invite [dinhi](%1).\\nNagdagan sa bersyong `%2`.' }
	},
	LOCALE: {
		DESCRIPTION: 'Usban ang locale ni Quaver dinhi nga server.',
		OPTION: { NEW_LOCALE: 'Ang locale na gamiton.' },
		RESPONSE: { SUCCESS: 'Ang locale para sa **%1** kay na usban og `%2`.' }
	},
	LOOP: {
		DESCRIPTION: 'I-loop ang queue.',
		OPTION: {
			TYPE: {
				DESCRIPTION: 'Ang looping mode.',
				OPTION: {
					DISABLED: 'Disabled',
					TRACK: 'Track',
					QUEUE: 'Queue'
				}
			}
		},
		RESPONSE: { SUCCESS: 'Ang looping mode gitakda sa **%1**' }
	},
	MOVE: {
		DESCRIPTION: 'Pagbalhin og track nga naa sulod sa queue.',
		OPTION: {
			OLD_POSITION: 'Ang posisyon sa track nga ibalhin.',
			NEW_POSITION: 'Ang bag-ong posisyon aron mabalhin ang track.'
		},
		RESPONSE: {
			SUCCESS: 'Nabalhin ang **[%1](%2)** `%3 -> %4`',
			QUEUE_INSUFFICIENT_TRACKS: 'Walay igong mga track sa queue aron makahimo og usa ka pagbalhin.',
			OUT_OF_RANGE: 'Usa (o pareho) sa imong mga argumento kay wala sa range.',
			MOVING_IN_PLACE: 'Ang imong mga argumento kay dili mahimong magkapareho.'
		}
	},
	NIGHTCORE: {
		DESCRIPTION: 'Ang nightcore mode kay magpapaspas sa imohang musika.',
		OPTION: { ENABLED: 'Kung gi-enable man o sa di ang nightcore, kung wala gipiho, kay matoggle ni.' },
		RESPONSE: {
			ENABLED: 'Ang nightcore ay **gi-enable**',
			DISABLED: 'Ang nightcore ay **gi-disable**'
		}
	},
	PAUSE: {
		DESCRIPTION: 'I-pause si Quaver.',
		RESPONSE: {
			SUCCESS: 'Gi-pause ang player.',
			STATE_UNCHANGED: 'Ang player kay napahunong na man.'
		}
	},
	PING: {
		DESCRIPTION: 'Susiha ang latency ug uptime ni Quaver.',
		RESPONSE: { SUCCESS: 'Pong!%1' },
		MISC: { UPTIME: 'Uptime:' }
	},
	PLAY: {
		DESCRIPTION: 'Patugtug og usa ka track.',
		OPTION: {
			QUERY: 'Unsay pangitaonon. Links gikan Spotify, YouTube ug daghan pa kay supported. Mangita siya sa YouTube.',
			INSERT: 'Kung ipatugtug ba o sa di ang track nga nagsunod.'
		},
		RESPONSE: {
			NO_RESULTS: {
				DEFAULT: 'Walay nakit-an nga mga resulta gikan sa imong query.',
				SPOTIFY: 'Walay nakit-an nga resulta sa imohang query sa Spotify.'
			},
			LOAD_FAILED: 'Napakyas sa pag-load sa track.'
		}
	},
	PLAYING: { DESCRIPTION: 'Ipakita unsay nagpatugtug karon.' },
	QUEUE: {
		DESCRIPTION: 'Ipakita ang queue.',
		RESPONSE: { QUEUE_EMPTY: 'Wala nay gasunod.' }
	},
	REMOVE: {
		DESCRIPTION: 'Pagtangtang og track gikan sa queue.',
		OPTION: { POSITION: 'Ang posisyon sa track nga itangtang.' },
		RESPONSE: {
			SUCCESS: 'Gitangtang ang **[%1](%2)**',
			QUEUE_EMPTY: 'Walay mga track sa queue nga tangtangonon.'
		}
	},
	RESUME: {
		DESCRIPTION: 'Ipadayon si Quaver.',
		RESPONSE: {
			SUCCESS: 'Ang player kay gipadayon.',
			STATE_UNCHANGED: 'Ang player kay nagpatugtug na man.'
		}
	},
	SEARCH: {
		DESCRIPTION: 'Mangita sa YouTube og usa ka track.',
		OPTION: { QUERY: 'Unsay pangitaonon.' },
		RESPONSE: { USE_PLAY_CMD: 'Suwayig gamit ang play command imbis ana.' },
		MISC: { PICK: 'Pili og (mga) track' }
	},
	SEEK: {
		DESCRIPTION: 'Laktaw ngadto sa laing timestamp sa kasamtangang track.',
		OPTION: {
			HOURS: 'Ang posisyon sa oras para sa target nga timestamp.',
			MINUTES: 'Ang posisyon sa minuto para sa target nga timestamp.',
			SECONDS: 'Ang posisyon sa segundo para sa target nga timestamp.'
		},
		RESPONSE: {
			SUCCESS: 'Nagseek ngadto sa `[%1 / %2]`',
			TIMESTAMP_MISSING: 'Palihug pagpiho ug timestamp nga i-seek.',
			TIMESTAMP_INVALID: 'Ang timestamp nga gihatag milagpas sa duration sa track nga `%1`.',
			STREAM_CANNOT_SEEK: 'Ang seek dili magamit para sa mga stream.'
		}
	},
	SHUFFLE: {
		DESCRIPTION: 'I-shuffle ang queue.',
		RESPONSE: {
			SUCCESS: 'Gi-shuffle ang queue.',
			QUEUE_INSUFFICIENT_TRACKS: 'Walay igong mga track sa queue aron makahimo og shuffle.'
		}
	},
	SKIP: {
		DESCRIPTION: 'Laktawi ang kasamtangang track.',
		RESPONSE: {
			SUCCESS: {
				DEFAULT: 'Gilaktawan ang **[%1](%2)**',
				VOTED: 'Nalaktawan ang **[%1](%2)** pinaagi sa boto'
			},
			VOTED: {
				SUCCESS: 'Giboto nga laktawan ang **[%1](%2)** `[%3 / %4]`',
				STATE_UNCHANGED: 'Nakaboto kana nga laktawan kini nga track.'
			}
		}
	},
	STOP: {
		DESCRIPTION: 'Ipahunong ang kasamtangang track ug i-clear ang queue.',
		RESPONSE: { SUCCESS: 'Gipahunong ang kasamtangang track ug na clear ang queue.' }
	},
	VOLUME: {
		DESCRIPTION: 'I-adjust ang volume ni Quaver.',
		OPTION: { NEW_VOLUME: 'Ang bag-ong volume aron ma-adjust.' },
		RESPONSE: {
			SUCCESS: 'Gi-adjust ang volume sa `%1%`',
			OUT_OF_RANGE: 'Dili kana sulod sa balido nga range sa `0%` to `200%`.'
		}
	}
};