export default {
	'247': {
		DESCRIPTION: 'Pinipigilan ng 24/7 na mode si Quaver mula sa pag-alis.',
		OPTION: { ENABLED: 'Naka-enable man o hindi ang 24/7 na mode. Kung hindi natukoy, ito ay ma-toggle.' },
		RESPONSE: {
			ENABLED: 'Ang 24/7 ay **naka-enable**',
			DISABLED: 'Ang 24/7 ay **naka-disable**',
			FEATURE_NOT_WHITELISTED: 'Ang server na ito ay hindi naka-whitelist upang gumamit ng 24/7.',
			QUEUE_CHANNEL_MISSING: 'Ang queue channel ay nawawala. Subukang gamitin ang `bind` na command.'
		},
		MISC: { NOTE: 'Gagamitin pa rin ni Quaver ang parehong mga voice at text channel kung nag-restart ito.' }
	},
	BASSBOOST: {
		DESCRIPTION: 'Pinapalakas ng bass boost na mode ang mga level ng bass.',
		OPTION: { ENABLED: 'Naka-enable man o hindi ang bass boost na mode. Kung hindi natukoy, ito ay ma-toggle.' },
		RESPONSE: {
			ENABLED: 'Ang bass boost ay **naka-enable**',
			DISABLED: 'Ang bass boost ay **naka-disable**'
		}
	},
	BIND: {
		DESCRIPTION: 'Baguhin ang channel na ginagamit ni Quaver para awtomatikong magpadala ng mga mensahe.',
		OPTION: { NEW_CHANNEL: 'Ang channel kung saan maba-bind.' },
		RESPONSE: {
			SUCCESS: 'Nakabind sa <#%1>',
			PERMISSIONS_INSUFFICIENT: 'Wala akong sapat na (mga) permission sa <#%1>.'
		}
	},
	CLEAR: {
		DESCRIPTION: 'I-clear ang queue.',
		RESPONSE: {
			SUCCESS: 'Na-clear na ang queue.',
			QUEUE_EMPTY: 'Walang mga track sa queue upang mai-clear.',
			CONFIRMATION: 'Sigurado ka bang gusto mong i-clear ang queue?'
		}
	},
	DISCONNECT: {
		DESCRIPTION: 'Idiskonekta si Quaver.',
		RESPONSE: {
			SUCCESS: 'Umalis sa voice channel.',
			FEATURE_247_ENABLED: 'Si Quaver ay hindi makaalis dahil ang 24/7 ay naka-enable.',
			CONFIRMATION: 'Sigurado ka bang gusto mong idiskonekta si Quaver? I-clear din nito ang queue.'
		}
	},
	INFO: {
		DESCRIPTION: 'Magpakita ng impormasyon tungkol kay Quaver.',
		RESPONSE: { SUCCESS: 'Open-source na music bot para sa maliliit na mga komunidad.\nAng source code ay available [dito](https://go.zptx.dev/Quaver), invite [dito](%1).\nTumatakbo sa bersyong `%2`.' }
	},
	LOOP: {
		DESCRIPTION: 'Baguhin ang mode sa paglo-loop.',
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
		RESPONSE: { SUCCESS: 'Ang looping mode ay nakatakda sa **%1**' }
	},
	MOVE: {
		DESCRIPTION: 'Maglipat ng track sa loob ng queue.',
		OPTION: {
			OLD_POSITION: 'Ang posisyon ng track upang ilipat.',
			NEW_POSITION: 'Ang bagong posisyon upang mailipat ang track.'
		},
		RESPONSE: {
			SUCCESS: 'Nailipat ang **[%1](%2)** `%3 -> %4`',
			QUEUE_INSUFFICIENT_TRACKS: 'Walang sapat na mga track sa queue upang magsagawa ng isang paglipat.',
			OUT_OF_RANGE: 'Ang iyong input ay hindi wasto.',
			MOVING_IN_PLACE: 'Hindi mo maaaring ilipat ang isang track sa parehong posisyon kung nasaan na ito.'
		}
	},
	NIGHTCORE: {
		DESCRIPTION: 'Pinapabilis ng nightcore mode ang iyong musika.',
		OPTION: { ENABLED: 'Naka-enable man ang nightcore na mode o hindi. Kung hindi natukoy, ito ay ma-toggle.' },
		RESPONSE: {
			ENABLED: 'Ang nightcore ay **naka-enable**',
			DISABLED: 'Ang nightcore ay **naka-disable**'
		}
	},
	PAUSE: {
		DESCRIPTION: 'I-pause si Quaver.',
		RESPONSE: {
			SUCCESS: 'Na-pause ang player.',
			STATE_UNCHANGED: 'Ang player ay naka-pause na.'
		}
	},
	PING: {
		DESCRIPTION: 'Ipakita ang latency at uptime ni Quaver.',
		RESPONSE: { SUCCESS: 'Pong!%1' },
		MISC: { UPTIME: 'Uptime:' }
	},
	PLAY: {
		DESCRIPTION: 'Magdagdag ng isang track sa queue.',
		OPTION: {
			QUERY: 'YouTube na search query o isang link mula sa Spotify o YouTube.',
			INSERT: 'Magpe-play man o hindi sa susunod na track.'
		},
		RESPONSE: {
			NO_RESULTS: {
				DEFAULT: 'Walang nahanap na mga resulta mula sa iyong query.',
				SPOTIFY: 'Walang nahanap na resulta mula sa iyong query sa Spotify.'
			},
			DISABLED: { SPOTIFY: 'Ang integration ng Spotify ay hindi na-configure.' },
			LOAD_FAILED: 'Nabigong i-load ang track.'
		}
	},
	PLAYING: { DESCRIPTION: 'Ipakita kung ano ang kasalukuyang nagpe-play.' },
	QUEUE: {
		DESCRIPTION: 'Ipakita ang queue.',
		RESPONSE: {
			QUEUE_EMPTY: 'Walang paparating.',
			OUT_OF_RANGE: 'Ang iyong input ay hindi wasto.'
		},
		MISC: {
			PAGE: 'Pahina',
			MODAL_TITLE: 'Pumunta sa pahinang'
		}
	},
	REMOVE: {
		DESCRIPTION: 'Mag-alis ng track mula sa queue.',
		OPTION: { POSITION: 'Ang posisyon ng track na aalisin.' },
		RESPONSE: {
			SUCCESS: 'Inalis ang **[%1](%2)**',
			QUEUE_EMPTY: 'Walang mga track sa queue na aalisin.'
		}
	},
	RESUME: {
		DESCRIPTION: 'Ipagpatuloy si Quaver.',
		RESPONSE: {
			SUCCESS: 'Ang player ay ipinagpatuloy.',
			STATE_UNCHANGED: 'Ang player ay naka-patugtug na.'
		}
	},
	SEARCH: {
		DESCRIPTION: 'Maghanap sa YouTube ng isang track.',
		OPTION: { QUERY: 'YouTube na search query.' },
		RESPONSE: { USE_PLAY_CMD: 'Subukang gamitin ang play command sa halip.' },
		MISC: { PICK: 'Pumili ng (mga) track' }
	},
	SEEK: {
		DESCRIPTION: 'Lumaktaw sa ibang timestamp sa kasalukuyang track.',
		OPTION: {
			HOURS: 'Ang posisyon ng oras para sa target na timestamp.',
			MINUTES: 'Ang mga minutong posisyon para sa target na timestamp.',
			SECONDS: 'Ang mga segundong posisyon para sa target na timestamp.'
		},
		RESPONSE: {
			SUCCESS: 'Nagseek sa `[%1 / %2]`',
			TIMESTAMP_MISSING: 'Pakiusap lang na tumukoy ng timestamp na i-seek.',
			TIMESTAMP_INVALID: 'Ang timestamp na ibinigay ay lumampas sa duration ng track na `%1`.',
			STREAM_CANNOT_SEEK: 'Ang seek ay hindi magagamit para sa mga stream.'
		}
	},
	SETTINGS: {
		DESCRIPTION: 'Baguhin ang mga setting ni Quaver sa server na ito.',
		RESPONSE: { HEADER: 'Mga setting sa **%1**' },
		MISC: {
			LANGUAGE: {
				NAME: 'Wika',
				DESCRIPTION: 'Ang wikang gagamitin sa server na ito.'
			},
			FORMAT: {
				NAME: 'Pormat',
				DESCRIPTION: 'Ang pormat ng "Nagpe-play ngayon" na gagamitin para sa server na ito.',
				EXAMPLE: {
					SIMPLE: 'Simpleng Pagpapakita ng Pormat',
					DETAILED: 'Detalyadong Pagpapakita ng Pormat'
				},
				OPTIONS: {
					SIMPLE: 'Simple',
					DETAILED: 'Detalyado'
				}
			}
		}
	},
	SHUFFLE: {
		DESCRIPTION: 'I-shuffle ang queue.',
		RESPONSE: {
			SUCCESS: 'Na-shuffle ang queue.',
			QUEUE_INSUFFICIENT_TRACKS: 'Walang sapat na mga track sa queue para magsagawa ng shuffle.'
		}
	},
	SKIP: {
		DESCRIPTION: 'Laktawan ang kasalukuyang track.',
		RESPONSE: {
			SUCCESS: {
				DEFAULT: 'Nilaktawan ang **[%1](%2)**',
				VOTED: 'Nilaktawan ang **[%1](%2)** sa pamamagitan ng pagboto'
			},
			VOTED: {
				SUCCESS: 'Nakaboto upang laktawan ang **[%1](%2)** `[%3 / %4]`',
				STATE_UNCHANGED: 'Nakaboto kana upang laktawan ang track na ito.'
			}
		}
	},
	STOP: {
		DESCRIPTION: 'Ipahinto ang kasalukuyang track at i-clear ang queue.',
		RESPONSE: {
			SUCCESS: 'Itinigil ang kasalukuyang track at na clear ang queue.',
			CONFIRMATION: 'Sigurado ka bang gusto mong ihinto ang kasalukuyang track at i-clear ang queue?'
		}
	},
	VOLUME: {
		DESCRIPTION: 'I-adjust ang volume ni Quaver.',
		OPTION: { NEW_VOLUME: 'Ang bagong volume na ia-adjust.' },
		RESPONSE: {
			SUCCESS: 'Inadjust ang volume sa `%1%`',
			OUT_OF_RANGE: 'Wala iyon sa wastong range ng `0%` to `200%`.'
		}
	}
};