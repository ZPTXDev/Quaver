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
const { createLogger, format, transports } = require('winston');
const { guildData } = require('./data.js');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});
rl.on('line', line => {
	switch (line.split(' ')[0].toLowerCase()) {
		case 'exit':
			shuttingDown('exit');
			break;
		case 'sessions':
			if (!startup) {
				console.log('Quaver is not initialized yet.');
				break;
			}
			console.log(`There are currently ${bot.music.players.size} active session(s).`);
			break;
		case 'stats': {
			const uptime = msToTime(bot.uptime);
			const uptimeString = msToTimeString(uptime);
			console.log(`Statistics:\nGuilds: ${bot.guilds.cache.size}\nUptime: ${uptimeString}`);
			break;
		}
		case 'whitelist': {
			if (!startup) {
				console.log('Quaver is not initialized yet.');
				break;
			}
			const guildId = line.split(' ')[1];
			if (!functions['247'].whitelist) {
				console.log('The 24/7 whitelist is not enabled.');
				break;
			}
			const guild = bot.guilds.cache.get(guildId);
			if (!guild) {
				console.log('Guild not found.');
				break;
			}
			if (!guildData.get(`${guildId}.247.whitelisted`)) {
				console.log(`Added ${guild.name} to the 24/7 whitelist.`);
				guildData.set(`${guildId}.247.whitelisted`, true);
			}
			else {
				console.log(`Removed ${guild.name} from the 24/7 whitelist.`);
				guildData.set(`${guildId}.247.whitelisted`, false);
			}
			break;
		}
		default:
			console.log('Available commands: exit, sessions, whitelist, stats');
			break;
	}
});
// 'close' event catches ctrl+c, therefore we pass it to shuttingDown as a ctrl+c event
rl.on('close', () => shuttingDown('SIGINT'));

const logger = createLogger({
	level: 'info',
	format: format.combine(
		format.errors({ stack: true }),
		format.timestamp(),
		format.printf(info => `${info.timestamp} [${info.label}] ${info.level.toUpperCase()}: ${info.message}`),
	),
	transports: [
		new transports.Console({
			format: format.combine(
				format(info => {
					info.level = info.level.toUpperCase();
					return info;
				})(),
				format.errors({ stack: true }),
				format.timestamp(),
				format.colorize(),
				format.printf(info => `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`),
			),
		}),
		new transports.File({ filename: 'logs/error.log', level: 'error' }),
		new transports.File({ filename: 'logs/log.log' }),
	],
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
	logger.info({ message: 'Connected.', label: 'Lavalink' });
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

bot.music.on('disconnect', () => {
	logger.warn({ message: 'Disconnected.', label: 'Lavalink' });
	logger.error({ message: 'Quaver is unable to resume after disconnecting from Lavalink and will now shut down gracefully to avoid issues.', label: 'Quaver' });
	shuttingDown('exit');
});

bot.music.on('queueFinish', queue => {
	if (guildData.get(`${queue.player.guildId}.always.enabled`)) {
		queue.channel.send({
			embeds: [
				new MessageEmbed()
					.setDescription(getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_QUEUE_EMPTY'))
					.setColor(defaultColor),
			],
		});
		return;
	}
	logger.info({ message: `[G ${queue.player.guildId}] Setting timeout`, label: 'Quaver' });
	if (queue.player.timeout) {
		clearTimeout(queue.player.timeout);
	}
	queue.player.timeout = setTimeout(p => {
		logger.info({ message: `[G ${p.guildId}] Disconnecting (inactivity)`, label: 'Quaver' });
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
	logger.info({ message: `[G ${queue.player.guildId}] Starting track`, label: 'Quaver' });
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

bot.music.on('trackEnd', (queue, track, reason) => {
	delete queue.player.skip;
	if (reason) {
		logger.warn({ message: `[G ${queue.player.guildId}] Track skipped with reason: ${reason}`, label: 'Quaver' });
		queue.channel.send({
			embeds: [
				new MessageEmbed()
					.setDescription(getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_TRACK_SKIPPED', track.title, track.uri, reason))
					.setColor('DARK_RED'),
			],
		});
	}
	if (bot.guilds.cache.get(queue.player.guildId).channels.cache.get(queue.player.channelId).members?.filter(m => !m.user.bot).size < 1 && !guildData.get(`${queue.player.guildId}.always.enabled`)) {
		logger.info({ message: `[G ${queue.player.guildId}] Disconnecting (alone)`, label: 'Quaver' });
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
		logger.info({ message: `Connected. Logged in as ${bot.user.tag}.`, label: 'Discord' });
		logger.info({ message: `Running version ${version}. For help, see https://github.com/ZapSquared/Quaver/issues.`, label: 'Quaver' });
		if (version.includes('-')) {
			logger.warn({ message: 'You are running an unstable version of Quaver. Please report bugs using the link above, and note that features may change or be removed entirely prior to release.', label: 'Quaver' });
		}
		bot.music.connect(bot.user.id);
		startup = true;
	}
	else {
		logger.info({ message: 'Reconnected.', label: 'Discord' });
		logger.warn({ message: 'Attempting to resume sessions.', label: 'Quaver' });
		for (const pair of bot.music.players) {
			const player = pair[1];
			await player.resume();
		}
	}
	bot.user.setActivity(version);
});

bot.on('shardDisconnect', () => {
	logger.warn({ message: 'Disconnected.', label: 'Discord' });
});

bot.on('error', err => {
	logger.error({ message: err, label: 'Quaver' });
});

bot.on('interactionCreate', async interaction => {
	if (interaction.isCommand()) {
		const command = bot.commands.get(interaction.commandName);
		if (!command) return;
		logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Processing command ${interaction.commandName}`, label: 'Quaver' });
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
			logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Command ${interaction.commandName} failed ${failedChecks.length} checks`, label: 'Quaver' });
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
		const botChannelPerms = interaction.channel.permissionsFor(bot.user.id);
		if (!botChannelPerms.has('VIEW_CHANNEL')) { failedPermissions.bot.push('VIEW_CHANNEL'); }
		if (!botChannelPerms.has('SEND_MESSAGES')) { failedPermissions.bot.push('SEND_MESSAGES'); }
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
			logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Executing command ${interaction.commandName}`, label: 'Quaver' });
			await command.execute(interaction);
		}
		catch (err) {
			logger.error({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Encountered error with command ${interaction.commandName}`, label: 'Quaver' });
			logger.error({ message: err, label: 'Quaver' });
			const replyData = {
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_CMD_ERROR'))
						.setColor('DARK_RED'),
				],
			};
			if (!interaction.replied && !interaction.deferred) {
				replyData.ephemeral = true;
				await interaction.reply(replyData);
			}
			else {
				await interaction.editReply(replyData);
			}
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
					logger.error({ message: err, label: 'Quaver' });
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
				logger.info({ message: `[G ${player.guildId}] Disconnecting (alone)`, label: 'Quaver' });
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
			logger.info({ message: `[G ${player.guildId}] Setting pause timeout`, label: 'Quaver' });
			if (player.pauseTimeout) {
				clearTimeout(player.pauseTimeout);
			}
			player.pauseTimeout = setTimeout(p => {
				logger.info({ message: `[G ${p.guildId}] Disconnecting (inactivity)`, label: 'Quaver' });
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
		logger.info({ message: `[G ${player.guildId}] Disconnecting (alone)`, label: 'Quaver' });
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
	logger.info({ message: `[G ${player.guildId}] Setting pause timeout`, label: 'Quaver' });
	if (player.pauseTimeout) {
		clearTimeout(player.pauseTimeout);
	}
	player.pauseTimeout = setTimeout(p => {
		logger.info({ message: `[G ${p.guildId}] Disconnecting (inactivity)`, label: 'Quaver' });
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
	logger.info({ message: `[G ${guild.id}] Joined guild ${guild.name}`, label: 'Discord' });
});

bot.on('guildDelete', guild => {
	logger.info({ message: `[G ${guild.id}] Left guild ${guild.name}`, label: 'Discord' });
});

bot.login(token);

let inProgress = false;
async function shuttingDown(eventType, err) {
	if (inProgress) return;
	inProgress = true;
	logger.info({ message: 'Shutting down...', label: 'Quaver' });
	if (startup) {
		logger.info({ message: 'Disconnecting from all guilds...', label: 'Quaver' });
		for (const pair of bot.music.players) {
			const player = pair[1];
			logger.info({ message: `[G ${player.guildId}] Disconnecting (restarting)`, label: 'Quaver' });
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
			const botChannelPerms = bot.guilds.cache.get(player.guildId).channels.cache.get(player.queue.channel.id).permissionsFor(bot.user.id);
			if (!botChannelPerms.has(['VIEW_CHANNEL', 'SEND_MESSAGES'])) { continue; }
			await player.queue.channel.send({
				embeds: [
					new MessageEmbed()
						.setDescription(`${getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, ['exit', 'SIGINT', 'SIGTERM'].includes(eventType) ? 'MUSIC_RESTART' : 'MUSIC_RESTART_CRASH')}${fileBuffer.length > 0 ? `\n${getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_RESTART_QUEUEDATA')}` : ''}`)
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
		logger.error({ message: err, label: 'Quaver' });
		logger.info({ message: 'Logging additional output to error.log.', label: 'Quaver' });
		try {
			await fsPromises.writeFile('error.log', `${eventType}${err.message ? `\n${err.message}` : ''}${err.stack ? `\n${err.stack}` : ''}`);
		}
		catch (e) {
			logger.error({ message: 'Encountered error while writing to error.log.', label: 'Quaver' });
			logger.error({ message: e, label: 'Quaver' });
		}
	}
	bot.destroy();
	process.exit();
}

['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM', 'uncaughtException', 'unhandledRejection'].forEach(eventType => {
	process.on(eventType, err => shuttingDown(eventType, err));
});
