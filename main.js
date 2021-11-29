require('@lavaclient/queue/register');
const { Client, Intents, Collection, MessageEmbed, MessageButton } = require('discord.js');
const { Node } = require('lavaclient');
const { load } = require('@lavaclient/spotify');
const { token, lavalink, spotify, defaultColor } = require('./settings.json');
const fs = require('fs');
const { version } = require('./package.json');
const { checks } = require('./enums.js');
const { msToTime, msToTimeString, paginate } = require('./functions.js');

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
	console.log('[Quaver] Connected to Lavalink!');
});

bot.music.on('queueFinish', queue => {
	console.log(`[G ${queue.player.guildId}] Setting timeout`);
	if (queue.player.timeout) {
		clearTimeout(queue.player.timeout);
	}
	queue.player.timeout = setTimeout(p => {
		console.log(`[G ${p.guildId}] Disconnecting (inactivity)`);
		const channel = p.queue.channel;
		p.disconnect();
		bot.music.destroyPlayer(p.guildId);
		channel.send({
			embeds: [
				new MessageEmbed()
					.setDescription('Disconnected from inactivity.')
					.setColor(defaultColor),
			],
		});
	}, 1800000, queue.player);
	queue.channel.send({
		embeds: [
			new MessageEmbed()
				.setDescription(`There's nothing left in the queue. I'll leave <t:${Math.floor(Date.now() / 1000) + 1800}:R>.`)
				.setColor(defaultColor),
		],
	});
});

bot.music.on('trackStart', (queue, song) => {
	console.log(`[G ${queue.player.guildId}] Starting track`);
	queue.player.pause(false);
	if (queue.player.timeout) {
		clearTimeout(queue.player.timeout);
		delete queue.player.timeout;
	}
	if (bot.guilds.cache.get(queue.player.guildId).channels.cache.get(queue.player.channelId).members?.filter(m => !m.bot).size < 1) {
		console.log(`[G ${queue.player.guildId}] Disconnecting (alone)`);
		queue.player.disconnect();
		bot.music.destroyPlayer(queue.player.guildId);
		queue.channel.send({
			embeds: [
				new MessageEmbed()
					.setDescription('Disconnected as everyone left.')
					.setColor(defaultColor),
			],
		});
		return;
	}
	const duration = msToTime(song.length);
	const durationString = song.isStream ? '∞' : msToTimeString(duration, true);
	queue.channel.send({
		embeds: [
			new MessageEmbed()
				.setDescription(`Now playing **[${song.title}](${song.uri})** \`[${durationString}]\`\nAdded by <@${song.requester}>`)
				.setColor(defaultColor),
		],
	});
});

bot.music.on('trackEnd', (queue) => {
	delete queue.player.skip;
});

bot.on('ready', async () => {
	if (!startup) {
		console.log(`[Quaver] Connected to Discord! Logged in as ${bot.user.tag}.`);
		console.log(`[Quaver] Running version ${version}. For help, see https://github.com/ZapSquared/Quaver/issues.`);
		bot.music.connect(bot.user.id);
		bot.user.setActivity(version);
		startup = true;
	}
	else {
		console.log('[Quaver] Lost connection to Discord. Attempting to resume sessions now.');
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
		console.log(`[U ${interaction.user.id}] Processing command ${interaction.commandName}`);
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
			console.log(`[U ${interaction.user.id}] Command ${interaction.commandName} failed ${failedChecks.length} checks`);
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(failedChecks[0])
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
						.setDescription(`You are missing permissions: ${failedPermissions.user.map(perm => '`' + perm + '`').join(' ')}`)
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
						.setDescription(`I am missing permissions: ${failedPermissions.user.map(perm => '`' + perm + '`').join(' ')}`)
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		try {
			console.log(`[U ${interaction.user.id}] Executing command ${interaction.commandName}`);
			await command.execute(interaction);
		}
		catch (err) {
			console.log(`[U ${interaction.user.id}] Encountered error with command ${interaction.commandName}`);
			console.error(err);
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription('There was an error while handling the command.')
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
					.setFooter(`Page ${page} of ${pages.length}`);
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
					.setLabel('Refresh'),
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
								.setDescription('That is not your interaction.')
								.setColor('DARK_RED'),
						],
						ephemeral: true,
					});
					return;
				}
				await interaction.update({
					embeds: [
						new MessageEmbed()
							.setDescription(`This interaction was canceled by <@${interaction.user.id}>.`)
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
								.setDescription('That is not your interaction.')
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
								.setDescription(checks.IN_VOICE)
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
								.setDescription(checks.IN_SESSION_VOICE)
								.setColor('DARK_RED'),
						],
						ephemeral: true,
					});
					return;
				}
				if (!player?.connected) {
					player = interaction.client.music.createPlayer(interaction.guildId);
					player.queue.channel = interaction.channel;
					await player.connect(interaction.member.voice.channelId, { deafened: true });
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
					msg = `Added **[${resolvedTracks[0].info.title}](${resolvedTracks[0].info.uri})** to queue`;
				}
				else {
					msg = `Added **${resolvedTracks.length}** tracks from **your search** to queue`;
				}
				player.queue.add(resolvedTracks, { requester: interaction.user.id });
				const started = player.playing || player.paused;
				await interaction.update({
					embeds: [
						new MessageEmbed()
							.setDescription(msg)
							.setColor(defaultColor)
							.setFooter(started ? `Position: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : ''),
					],
					components: [],
				});
				if (!started) { await player.queue.start(); }
			}
		}
	}
});

bot.login(token);