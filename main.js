require('@lavaclient/queue/register');
const { Client, Intents, Collection, MessageEmbed, MessageButton, Permissions } = require('discord.js');
const { Node } = require('lavaclient');
const { load } = require('@lavaclient/spotify');
const { token, lavalink, spotify, defaultColor, defaultLocale, functions } = require('./settings.json');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { version } = require('./package.json');
const { checks } = require('./enums.js');
const { msToTime, msToTimeString, paginate, getLocale } = require('./functions.js');
const readline = require('readline');
const { guildData } = require('./data.js');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});
rl.on('line', line => {
	switch (line.split(' ')[0]) {
		case 'exit':
			shuttingDown('exit');
			break;
		case 'sessions':
			if (!startup) {
				console.log(getLocale(defaultLocale, 'CMDLINE_NOT_INITIALIZED'));
				break;
			}
			console.log(getLocale(defaultLocale, 'CMDLINE_SESSIONS', bot.music.players.size));
			break;
		case 'stats': {
			const uptime = msToTime(bot.uptime);
			const uptimeString = msToTimeString(uptime);
			console.log(getLocale(defaultLocale, 'CMDLINE_STATS', bot.guilds.cache.size, uptimeString));
			break;
		}
		case 'whitelist': {
			if (!startup) {
				console.log(getLocale(defaultLocale, 'CMDLINE_NOT_INITIALIZED'));
				break;
			}
			const guildId = line.split(' ')[1];
			if (!functions['247'].whitelist) {
				console.log(getLocale(defaultLocale, 'CMDLINE_247_WHITELIST_DISABLED'));
				break;
			}
			const guild = bot.guilds.cache.get(guildId);
			if (!guild) {
				console.log(getLocale(defaultLocale, 'CMDLINE_247_WHITELIST_GUILD_NOT_FOUND'));
				break;
			}
			if (!guildData.get(`${guildId}.247.whitelisted`)) {
				console.log(getLocale(defaultLocale, 'CMDLINE_247_WHITELIST_ADDED', guild.name));
				guildData.set(`${guildId}.247.whitelisted`, true);
			}
			else {
				console.log(getLocale(defaultLocale, 'CMDLINE_247_WHITELIST_REMOVED', guild.name));
				guildData.set(`${guildId}.247.whitelisted`, false);
			}
			break;
		}
		default:
			console.log(getLocale(defaultLocale, 'CMDLINE_HELP'));
			break;
	}
});

load({
	client: {
		id: spotify.client_id,
		secret: spotify.client_secret,
	},
	autoResolveYoutubeTracks: false,
});

const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_PRESENCES, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
bot.commands = new Collection();
bot.music = new Node({
	connection: {
		host: lavalink.host,
		port: lavalink.port,
		password: lavalink.password,
		secure: !!lavalink.secure,
	},
	sendGatewayPayload: (id, payload) => bot.guilds.cache.get(id)?.shard?.send(payload),
});
bot.ws.on('VOICE_SERVER_UPDATE', data => bot.music.handleVoiceUpdate(data));
bot.ws.on('VOICE_STATE_UPDATE', data => bot.music.handleVoiceUpdate(data));

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	bot.commands.set(command.data.name, command);
}
let startup = false;

bot.music.on('connect', () => {
	console.log(`[Quaver] ${getLocale(defaultLocale, 'LOG_LAVALINK_CONNECTED')}`);
	Object.keys(guildData.data).forEach(async guildId => {
		if (guildData.get(`${guildId}.always.enabled`)) {
			const guild = bot.guilds.cache.get(guildId);
			const player = bot.music.createPlayer(guildId);
			player.queue.channel = guild.channels.cache.get(guildData.get(`${guildId}.always.text`));
			const voice = guild.channels.cache.get(guildData.get(`${guildId}.always.channel`));
			if (voice.type === 'GUILD_STAGE_VOICE' && !voice.stageInstance) {
				await voice.createStageInstance({ topic: getLocale(guildData.get(`${guildId}.locale`) ?? defaultLocale, 'MUSIC_STAGE_TOPIC'), privacyLevel: 'GUILD_ONLY' });
			}
			await player.connect(guildData.get(`${guildId}.always.channel`), { deafened: true });
		}
	});
});

bot.music.on('queueFinish', queue => {
	if (guildData.get(`${queue.player.guildId}.always.enabled`)) {
		queue.channel.send({
			embeds: [
				new MessageEmbed()
					.setDescription(`${getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_QUEUE_EMPTY')}`)
					.setColor(defaultColor),
			],
		});
		return;
	}
	console.log(`[G ${queue.player.guildId}] ${getLocale(defaultLocale, 'LOG_SETTING_TIMEOUT')}`);
	if (queue.player.timeout) {
		clearTimeout(queue.player.timeout);
	}
	queue.player.timeout = setTimeout(p => {
		console.log(`[G ${p.guildId}] ${getLocale(defaultLocale, 'LOG_INACTIVITY')}`);
		const channel = p.queue.channel;
		clearTimeout(p.pauseTimeout);
		p.disconnect();
		bot.music.destroyPlayer(p.guildId);
		channel.send({
			embeds: [
				new MessageEmbed()
					.setDescription(getLocale(guildData.get(`${p.guildId}.locale`) ?? defaultLocale, 'MUSIC_INACTIVITY'))
					.setColor(defaultColor),
			],
		});
	}, 1800000, queue.player);
	queue.channel.send({
		embeds: [
			new MessageEmbed()
				.setDescription(`${getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_QUEUE_EMPTY')} ${getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_INACTIVITY_WARNING', Math.floor(Date.now() / 1000) + 1800)}`)
				.setColor(defaultColor),
		],
	});
});

bot.music.on('trackStart', async (queue, song) => {
	console.log(`[G ${queue.player.guildId}] ${getLocale(defaultLocale, 'LOG_STARTING_TRACK')}`);
	queue.player.pause(false);
	if (queue.player.timeout) {
		clearTimeout(queue.player.timeout);
		delete queue.player.timeout;
	}
	const duration = msToTime(song.length);
	const durationString = song.isStream ? '∞' : msToTimeString(duration, true);
	await queue.channel.send({
		embeds: [
			new MessageEmbed()
				.setDescription(`${getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_NOW_PLAYING', song.title, song.uri, durationString)}\n${getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ADDED_BY', song.requester)}`)
				.setColor(defaultColor),
		],
	});
});

bot.music.on('trackEnd', queue => {
	delete queue.player.skip;
	if (bot.guilds.cache.get(queue.player.guildId).channels.cache.get(queue.player.channelId).members?.filter(m => !m.user.bot).size < 1 && !guildData.get(`${queue.player.guildId}.always.enabled`)) {
		console.log(`[G ${queue.player.guildId}] ${getLocale(defaultLocale, 'LOG_ALONE')}`);
		queue.player.disconnect();
		bot.music.destroyPlayer(queue.player.guildId);
		queue.channel.send({
			embeds: [
				new MessageEmbed()
					.setDescription(getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ALONE'))
					.setColor(defaultColor),
			],
		});
		return;
	}
});

bot.on('ready', async () => {
	if (!startup) {
		console.log(`[Quaver] ${getLocale(defaultLocale, 'LOG_DISCORD_CONNECTED', bot.user.tag)}`);
		console.log(`[Quaver] ${getLocale(defaultLocale, 'LOG_STARTUP', version)}`);
		bot.music.connect(bot.user.id);
		bot.user.setActivity(version);
		startup = true;
	}
	else {
		console.log(`[Quaver] ${getLocale(defaultLocale, 'LOG_CONNECTION_LOST')}`);
		for (const pair of bot.music.players) {
			const player = pair[1];
			await player.resume();
		}
	}
});

bot.on('interactionCreate', async interaction => {
	if (interaction.isCommand()) {
		const command = bot.commands.get(interaction.commandName);
		if (!command) return;
		console.log(`[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] ${getLocale(defaultLocale, 'LOG_CMD_PROCESSING', interaction.commandName)}`);
		const failedChecks = [];
		for (const check of command.checks) {
			switch (check) {
				// Only allowed in guild
				case checks.GUILD_ONLY:
					if (!interaction.guildId) {
						failedChecks.push(check);
					}
					break;
				// Must have an active session
				case checks.ACTIVE_SESSION: {
					const player = bot.music.players.get(interaction.guildId);
					if (!player) {
						failedChecks.push(check);
					}
					break;
				}
				// Must be in a voice channel
				case checks.IN_VOICE:
					if (!interaction.member?.voice.channelId) {
						failedChecks.push(check);
					}
					break;
				// Must be in the same voice channel (will not fail if the bot is not in a voice channel)
				case checks.IN_SESSION_VOICE: {
					const player = bot.music.players.get(interaction.guildId);
					if (player && interaction.member?.voice.channelId !== player.channelId) {
						failedChecks.push(check);
					}
					break;
				}
			}
		}
		if (failedChecks.length > 0) {
			console.log(`[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] ${getLocale(defaultLocale, 'LOG_CMD_FAILED', interaction.commandName, failedChecks.length)}`);
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, failedChecks[0]))
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		const failedPermissions = { user: [], bot: [] };
		for (const perm of command.permissions.user) {
			if (!interaction.member.permissions.has(perm)) {
				failedPermissions.user.push(perm);
			}
		}
		for (const perm of command.permissions.bot) {
			if (!interaction.guild.members.cache.get(bot.user.id).permissions.has(perm)) {
				failedPermissions.user.push(perm);
			}
		}
		if (failedPermissions.user.length > 0) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_USER_MISSING_PERMISSIONS', failedPermissions.user.map(perm => '`' + perm + '`').join(' ')))
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		if (failedPermissions.bot.length > 0) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_BOT_MISSING_PERMISSIONS', failedPermissions.bot.map(perm => '`' + perm + '`').join(' ')))
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		try {
			console.log(`[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] ${getLocale(defaultLocale, 'LOG_CMD_EXECUTING', interaction.commandName)}`);
			await command.execute(interaction);
		}
		catch (err) {
			console.log(`[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] ${getLocale(defaultLocale, 'LOG_CMD_ERROR', interaction.commandName)}`);
			console.error(err);
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_CMD_ERROR'))
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
		}
	}
	else if (interaction.isButton()) {
		const type = interaction.customId.split('_')[0];
		switch (type) {
			case 'queue': {
				const player = bot.music.players.get(interaction.guildId);
				let pages, page;
				if (player) {
					pages = paginate(player.queue.tracks, 5);
					page = parseInt(interaction.customId.split('_')[1]);
				}
				if (!player || page < 1 || page > pages.length) {
					const original = interaction.message.components;
					original[0].components.forEach(c => c.setDisabled(true));
					await interaction.update({
						components: original,
					});
					return;
				}
				const firstIndex = 5 * (page - 1) + 1;
				const pageSize = pages[page - 1].length;
				const largestIndexSize = (firstIndex + pageSize - 1).toString().length;
				const original = { embeds: interaction.message.embeds, components: interaction.message.components };
				original.embeds[0]
					.setDescription(pages[page - 1].map((track, index) => {
						const duration = msToTime(track.length);
						const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
						return `\`${(firstIndex + index).toString().padStart(largestIndexSize, ' ')}.\` **[${track.title}](${track.uri})** \`[${durationString}]\` <@${track.requester}>`;
					}).join('\n'))
					.setFooter({ text: getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'PAGE', page, pages.length) });
				original.components[0].components = [];
				original.components[0].components[0] = new MessageButton()
					.setCustomId(`queue_${page - 1}`)
					.setEmoji('⬅️')
					.setDisabled(page - 1 < 1)
					.setStyle('PRIMARY');
				original.components[0].components[1] = new MessageButton()
					.setCustomId(`queue_${page + 1}`)
					.setEmoji('➡️')
					.setDisabled(page + 1 > pages.length)
					.setStyle('PRIMARY');
				original.components[0].components[2] = new MessageButton()
					.setCustomId(`queue_${page}`)
					.setEmoji('🔁')
					.setStyle('SECONDARY')
					.setLabel(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'REFRESH')),
				interaction.update({
					embeds: original.embeds,
					components: original.components,
				});
				break;
			}
			case 'cancel':
				if (interaction.customId.split('_')[1] !== interaction.user.id) {
					await interaction.reply({
						embeds: [
							new MessageEmbed()
								.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_INTERACTION_WRONG_USER'))
								.setColor('DARK_RED'),
						],
						ephemeral: true,
					});
					return;
				}
				await interaction.update({
					embeds: [
						new MessageEmbed()
							.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_INTERACTION_CANCELED', interaction.user.id))
							.setColor(defaultColor),
					],
					components: [],
				});
				break;
		}
	}
	else if (interaction.isSelectMenu()) {
		const type = interaction.customId.split('_')[0];
		switch (type) {
			case 'play': {
				if (interaction.customId.split('_')[1] !== interaction.user.id) {
					await interaction.reply({
						embeds: [
							new MessageEmbed()
								.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_INTERACTION_WRONG_USER'))
								.setColor('DARK_RED'),
						],
						ephemeral: true,
					});
					return;
				}
				const tracks = interaction.values;
				let player = interaction.client.music.players.get(interaction.guildId);
				if (!interaction.member?.voice.channelId) {
					await interaction.reply({
						embeds: [
							new MessageEmbed()
								.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, checks.IN_VOICE))
								.setColor('DARK_RED'),
						],
						ephemeral: true,
					});
					return;
				}
				if (player && interaction.member?.voice.channelId !== player.channelId) {
					await interaction.reply({
						embeds: [
							new MessageEmbed()
								.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, checks.IN_SESSION_VOICE))
								.setColor('DARK_RED'),
						],
						ephemeral: true,
					});
					return;
				}
				// check for connect, speak permission for channel
				const permissions = interaction.member?.voice.channel.permissionsFor(bot.user.id);
				if (!permissions.has(['VIEW_CHANNEL', 'CONNECT', 'SPEAK'])) {
					await interaction.reply({
						embeds: [
							new MessageEmbed()
								.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_BOT_MISSING_PERMISSIONS_BASIC'))
								.setColor('DARK_RED'),
						],
						ephemeral: true,
					});
					return;
				}
				if (interaction.member?.voice.channel.type === 'GUILD_STAGE_VOICE' && !permissions.has(Permissions.STAGE_MODERATOR)) {
					await interaction.reply({
						embeds: [
							new MessageEmbed()
								.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_BOT_MISSING_PERMISSIONS_STAGE'))
								.setColor('DARK_RED'),
						],
						ephemeral: true,
					});
					return;
				}

				await interaction.deferUpdate();
				if (!player?.connected) {
					player = interaction.client.music.createPlayer(interaction.guildId);
					player.queue.channel = interaction.channel;
					await player.connect(interaction.member.voice.channelId, { deafened: true });
					// that kid left while we were busy bruh
					if (!interaction.member.voice.channelId) {
						player.disconnect();
						bot.music.destroyPlayer(interaction.guildId);
						await interaction.editReply({
							embeds: [
								new MessageEmbed()
									.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_INTERACTION_CANCELED', interaction.user.id))
									.setColor(defaultColor),
							],
							components: [],
						});
						return;
					}
					if (interaction.member?.voice.channel.type === 'GUILD_STAGE_VOICE' && !interaction.member?.voice.channel.stageInstance) {
						await interaction.member.voice.channel.createStageInstance({ topic: getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_STAGE_TOPIC'), privacyLevel: 'GUILD_ONLY' });
					}
				}

				const resolvedTracks = [];
				for (const track of tracks) {
					const results = await interaction.client.music.rest.loadTracks(track);
					if (results.loadType === 'TRACK_LOADED') {
						resolvedTracks.push(results.tracks[0]);
					}
				}
				const firstPosition = player.queue.tracks.length + 1;
				const endPosition = firstPosition + resolvedTracks.length - 1;
				let msg;
				if (resolvedTracks.length === 1) {
					msg = getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_QUEUE_ADDED', resolvedTracks[0].info.title, resolvedTracks[0].info.uri);
				}
				else {
					msg = getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_QUEUE_ADDED_MULTI', resolvedTracks.length, getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_SEARCH'), '');
				}
				player.queue.add(resolvedTracks, { requester: interaction.user.id });
				const started = player.playing || player.paused;
				await interaction.editReply({
					embeds: [
						new MessageEmbed()
							.setDescription(msg)
							.setColor(defaultColor)
							.setFooter({ text: started ? `${getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'POSITION')}: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : '' }),
					],
					components: [],
				});
				if (!started) { await player.queue.start(); }
				const state = interaction.guild.members.cache.get(interaction.client.user.id).voice;
				if (state.channel.type === 'GUILD_STAGE_VOICE' && state.suppress) {
					await state.setSuppressed(false);
				}
			}
		}
	}
});

bot.on('voiceStateUpdate', async (oldState, newState) => {
	const guild = oldState.guild;
	const player = bot.music.players.get(guild.id);
	if (!player) return;
	// Quaver voiceStateUpdate
	if (oldState.member.user.id === bot.user.id) {
		// just the suppress state changed
		if ((oldState.suppress !== newState.suppress || oldState.serverMute !== newState.serverMute || oldState.serverDeaf !== newState.serverDeaf) && oldState.channelId === newState.channelId) {
			return;
		}
		// disconnected
		if (!newState.channelId) {
			if (guildData.get(`${player.guildId}.always.enabled`)) {
				guildData.set(`${player.guildId}.always.enabled`, false);
			}
			const channel = player.queue.channel;
			clearTimeout(player.timeout);
			clearTimeout(player.pauseTimeout);
			bot.music.destroyPlayer(player.guildId);
			await channel.send({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_FORCED'))
						.setColor(defaultColor),
				],
			});
			return;
		}
		// channel is a stage channel, and bot is suppressed
		// this also handles suppressing Quaver mid-track
		if (newState.channel.type === 'GUILD_STAGE_VOICE' && newState.suppress) {
			const permissions =	bot.guilds.cache.get(guild.id).channels.cache.get(newState.channelId).permissionsFor(bot.user.id);
			if (!permissions.has(Permissions.STAGE_MODERATOR)) {
				if (guildData.get(`${player.guildId}.always.enabled`)) {
					guildData.set(`${player.guildId}.always.enabled`, false);
				}
				const channel = player.queue.channel;
				clearTimeout(player.timeout);
				clearTimeout(player.pauseTimeout);
				player.disconnect();
				bot.music.destroyPlayer(guild.id);
				try {
					await channel.send({
						embeds: [
							new MessageEmbed()
								.setDescription(getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_FORCED_STAGE'))
								.setColor(defaultColor),
						],
					});
				}
				catch (err) {
					console.error(err);
				}
				return;
			}
			await newState.setSuppressed(false);
			if (!newState.channel.stageInstance) {
				await newState.channel.createStageInstance({ topic: getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_STAGE_TOPIC'), privacyLevel: 'GUILD_ONLY' });
			}
		}
		// the new vc has no humans
		if (newState.channel.members.filter(m => !m.user.bot).size < 1 && !guildData.get(`${player.guildId}.always.enabled`)) {
			// the bot is not playing anything - leave immediately
			if (!player.queue.current || !player.playing && !player.paused) {
				if (guildData.get(`${player.guildId}.always.enabled`)) {
					guildData.set(`${player.guildId}.always.enabled`, false);
				}
				console.log(`[G ${player.guildId}] ${getLocale(defaultLocale, 'LOG_ALONE')}`);
				const channel = player.queue.channel;
				clearTimeout(player.timeout);
				clearTimeout(player.pauseTimeout);
				player.disconnect();
				bot.music.destroyPlayer(player.guildId);
				channel.send({
					embeds: [
						new MessageEmbed()
							.setDescription(getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ALONE_MOVED'))
							.setColor(defaultColor),
					],
				});
				return;
			}
			// avoid pauseTimeout if 24/7 is enabled
			if (guildData.get(`${player.guildId}.always.enabled`)) return;
			// the bot was playing something - set pauseTimeout
			await player.pause();
			console.log(`[G ${player.guildId}] ${getLocale(defaultLocale, 'LOG_SETTING_TIMEOUT_PAUSE')}`);
			if (player.pauseTimeout) {
				clearTimeout(player.pauseTimeout);
			}
			player.pauseTimeout = setTimeout(p => {
				console.log(`[G ${p.guildId}] ${getLocale(defaultLocale, 'LOG_INACTIVITY')}`);
				const channel = p.queue.channel;
				clearTimeout(p.timeout);
				p.disconnect();
				bot.music.destroyPlayer(p.guildId);
				channel.send({
					embeds: [
						new MessageEmbed()
							.setDescription(getLocale(guildData.get(`${p.guildId}.locale`) ?? defaultLocale, 'MUSIC_INACTIVITY'))
							.setColor(defaultColor),
					],
				});
			}, 300000, player);
			await player.queue.channel.send({
				embeds: [
					new MessageEmbed()
						.setDescription(`${getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ALONE_WARNING')} ${getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_INACTIVITY_WARNING', Math.floor(Date.now() / 1000) + 300)}`)
						.setFooter({ text: getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ALONE_REJOIN') })
						.setColor(defaultColor),
				],
			});
		}
		// the new vc has humans and pauseTimeout is set
		else if (newState.channel.members.filter(m => !m.user.bot).size >= 1 && player.pauseTimeout) {
			player.resume();
			clearTimeout(player.pauseTimeout);
			delete player.pauseTimeout;
			await player.queue.channel.send({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ALONE_RESUMED'))
						.setColor(defaultColor),
				],
			});
			return;
		}
	}
	// other bots voiceStateUpdate - ignore
	if (oldState.member.user.bot) return;
	// user voiceStateUpdate, the channel is the bot's channel, and there's a pauseTimeout
	if (newState.channelId === player?.channelId && player?.pauseTimeout) {
		player.resume();
		if (player.pauseTimeout) {
			clearTimeout(player.pauseTimeout);
			delete player.pauseTimeout;
		}
		await player.queue.channel.send({
			embeds: [
				new MessageEmbed()
					.setDescription(getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ALONE_RESUMED'))
					.setColor(defaultColor),
			],
		});
		return;
	}
	// user has nothing to do with us
	if (oldState.channelId !== player?.channelId) return;
	// user didn't leave the vc
	if (newState.channelId === oldState.channelId) return;
	// vc still has people
	if (oldState.channel.members.filter(m => !m.user.bot).size >= 1) return;
	// 24/7 mode enabled, ignore
	if (guildData.get(`${guild.id}.always.enabled`)) return;
	// nothing is playing so we just leave
	if (!player.queue.current || !player.playing && !player.paused) {
		console.log(`[G ${player.guildId}] ${getLocale(defaultLocale, 'LOG_ALONE')}`);
		const channel = player.queue.channel;
		clearTimeout(player.timeout);
		clearTimeout(player.pauseTimeout);
		player.disconnect();
		bot.music.destroyPlayer(player.guildId);
		channel.send({
			embeds: [
				new MessageEmbed()
					.setDescription(getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ALONE'))
					.setColor(defaultColor),
			],
		});
		return;
	}
	await player.pause();
	console.log(`[G ${player.guildId}] ${getLocale(defaultLocale, 'LOG_SETTING_TIMEOUT_PAUSE')}`);
	if (player.pauseTimeout) {
		clearTimeout(player.pauseTimeout);
	}
	player.pauseTimeout = setTimeout(p => {
		console.log(`[G ${p.guildId}] ${getLocale(defaultLocale, 'LOG_INACTIVITY')}`);
		const channel = p.queue.channel;
		clearTimeout(p.timeout);
		p.disconnect();
		bot.music.destroyPlayer(p.guildId);
		channel.send({
			embeds: [
				new MessageEmbed()
					.setDescription(getLocale(guildData.get(`${p.guildId}.locale`) ?? defaultLocale, 'MUSIC_INACTIVITY'))
					.setColor(defaultColor),
			],
		});
	}, 300000, player);
	await player.queue.channel.send({
		embeds: [
			new MessageEmbed()
				.setDescription(`${getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ALONE_WARNING')} ${getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_INACTIVITY_WARNING', Math.floor(Date.now() / 1000) + 300)}`)
				.setFooter({ text: getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ALONE_REJOIN') })
				.setColor(defaultColor),
		],
	});
});

bot.on('guildCreate', guild => {
	console.log(`[G ${guild.id}] ${getLocale(defaultLocale, 'LOG_GUILD_JOINED', guild.name)}`);
});

bot.on('guildDelete', guild => {
	console.log(`[G ${guild.id}] ${getLocale(defaultLocale, 'LOG_GUILD_LEFT', guild.name)}`);
});

bot.login(token);

let inprg = false;
async function shuttingDown(eventType, err) {
	if (inprg) return;
	inprg = true;
	console.log(`[Quaver] ${getLocale(defaultLocale, 'LOG_SHUTDOWN')}`);
	if (startup) {
		console.log(`[Quaver] ${getLocale(defaultLocale, 'LOG_DISCONNECTING')}`);
		for (const pair of bot.music.players) {
			const player = pair[1];
			console.log(`[G ${player.guildId}] ${getLocale(defaultLocale, 'LOG_RESTARTING')}`);
			const fileBuffer = [];
			if (player.queue.tracks.length > 0 || player.queue.current && (player.playing || player.paused)) {
				fileBuffer.push(`${getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'CURRENT')}:`);
				fileBuffer.push(player.queue.current.uri);
				if (player.queue.tracks.length > 0) {
					fileBuffer.push(`${getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'QUEUE')}:`);
					fileBuffer.push(player.queue.tracks.map(track => track.uri).join('\n'));
				}
			}
			player.disconnect();
			bot.music.destroyPlayer(player.guildId);
			await player.queue.channel.send({
				embeds: [
					new MessageEmbed()
						.setDescription(`${getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, ['exit', 'SIGINT'].includes(eventType) ? 'MUSIC_RESTART' : 'MUSIC_RESTART_CRASH')}${fileBuffer.length > 0 ? `\n${getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_RESTART_QUEUEDATA')}` : ''}`)
						.setFooter({ text: getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_RESTART_SORRY') })
						.setColor(defaultColor),
				],
				files: fileBuffer.length > 0 ? [
					{
						attachment: Buffer.from(fileBuffer.join('\n')),
						name: 'queue.txt',
					},
				] : [],
			});
		}
	}
	if (!['exit', 'SIGINT', 'SIGTERM'].includes(eventType)) {
		console.log(`[Quaver] ${getLocale(defaultLocale, 'LOG_ERROR')}`);
		try {
			await fsPromises.writeFile('error.log', `${eventType}${err.message ? `\n${err.message}` : ''}${err.stack ? `\n${err.stack}` : ''}`);
		}
		catch (e) {
			console.error(`[Quaver] ${getLocale(defaultLocale, 'LOG_ERROR_FAIL')}\n${e}`);
		}
	}
	bot.destroy();
	process.exit();
}

['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM', 'uncaughtException', 'unhandledRejection'].forEach(eventType => {
	process.on(eventType, err => shuttingDown(eventType, err));
});
