const { MessageEmbed, MessageButton, Permissions } = require('discord.js');
const { logger, guildData } = require('../shared.js');
const { getLocale, paginate, msToTime, msToTimeString } = require('../functions.js');
const { checks } = require('../enums.js');
const { defaultLocale, defaultColor } = require('../settings.json');
const ReplyHandler = require('../classes/ReplyHandler.js');
const MusicHandler = require('../classes/MusicHandler.js');

module.exports = {
	name: 'interactionCreate',
	once: false,
	async execute(interaction) {
		interaction.replyHandler = new ReplyHandler(interaction);
		if (interaction.isCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);
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
						const player = interaction.client.music.players.get(interaction.guildId);
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
						const player = interaction.client.music.players.get(interaction.guildId);
						if (player && interaction.member?.voice.channelId !== player.channelId) {
							failedChecks.push(check);
						}
						break;
					}
				}
			}
			if (failedChecks.length > 0) {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Command ${interaction.commandName} failed ${failedChecks.length} check(s)`, label: 'Quaver' });
				await interaction.replyHandler.localeError(failedChecks[0]);
				return;
			}
			const failedPermissions = { user: [], bot: [] };
			if (interaction.guildId) {
				for (const perm of command.permissions.user) {
					if (!interaction.channel.permissionsFor(interaction.member).has(perm)) {
						failedPermissions.user.push(perm);
					}
				}
				for (const perm of ['VIEW_CHANNEL', 'SEND_MESSAGES', ...command.permissions.bot]) {
					if (!interaction.channel.permissionsFor(interaction.client.user.id).has(perm)) {
						failedPermissions.bot.push(perm);
					}
				}
			}
			else {
				failedPermissions.user = command.permissions.user;
				failedPermissions.bot = command.permissions.bot;
			}
			if (failedPermissions.user.length > 0) {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Command ${interaction.commandName} failed ${failedPermissions.user.length} user permission check(s)`, label: 'Quaver' });
				await interaction.replyHandler.localeError('DISCORD_USER_MISSING_PERMISSIONS', {}, failedPermissions.user.map(perm => '`' + perm + '`').join(' '));
				return;
			}
			if (failedPermissions.bot.length > 0) {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Command ${interaction.commandName} failed ${failedPermissions.bot.length} bot permission check(s)`, label: 'Quaver' });
				await interaction.replyHandler.localeError('DISCORD_BOT_MISSING_PERMISSIONS', {}, failedPermissions.bot.map(perm => '`' + perm + '`').join(' '));
				return;
			}
			try {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Executing command ${interaction.commandName}`, label: 'Quaver' });
				await command.execute(interaction);
			}
			catch (err) {
				logger.error({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Encountered error with command ${interaction.commandName}`, label: 'Quaver' });
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				await interaction.replyHandler.localeError('DISCORD_CMD_ERROR');
			}
		}
		else if (interaction.isButton()) {
			const type = interaction.customId.split('_')[0];
			switch (type) {
				case 'queue': {
					const player = interaction.client.music.players.get(interaction.guildId);
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
						.setFooter({ text: getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MISC_PAGE', page, pages.length) });
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
						.setLabel(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MISC_REFRESH'));
					try {
						interaction.update({
							embeds: original.embeds,
							components: original.components,
						});
					}
					catch (err) {
						logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
					}
					break;
				}
				case 'cancel':
					if (interaction.customId.split('_')[1] !== interaction.user.id) {
						await interaction.replyHandler.localeError('DISCORD_INTERACTION_WRONG_USER');
						return;
					}
					try {
						await interaction.update({
							embeds: [
								new MessageEmbed()
									.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'DISCORD_INTERACTION_CANCELED', interaction.user.id))
									.setColor(defaultColor),
							],
							components: [],
						});
					}
					catch (err) {
						logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
					}
					break;
			}
		}
		else if (interaction.isSelectMenu()) {
			const type = interaction.customId.split('_')[0];
			switch (type) {
				case 'play': {
					if (interaction.customId.split('_')[1] !== interaction.user.id) {
						await interaction.replyHandler.localeError('DISCORD_INTERACTION_WRONG_USER');
						return;
					}
					const tracks = interaction.values;
					let player = interaction.client.music.players.get(interaction.guildId);
					if (!interaction.member?.voice.channelId) {
						await interaction.replyHandler.localeError(checks.IN_VOICE);
						return;
					}
					if (player && interaction.member?.voice.channelId !== player.channelId) {
						await interaction.replyHandler.localeError(checks.IN_SESSION_VOICE);
						return;
					}
					// check for connect, speak permission for channel
					const permissions = interaction.member?.voice.channel.permissionsFor(interaction.client.user.id);
					if (!permissions.has(['VIEW_CHANNEL', 'CONNECT', 'SPEAK'])) {
						await interaction.replyHandler.localeError('DISCORD_BOT_MISSING_PERMISSIONS_BASIC');
						return;
					}
					if (interaction.member?.voice.channel.type === 'GUILD_STAGE_VOICE' && !permissions.has(Permissions.STAGE_MODERATOR)) {
						await interaction.replyHandler.localeError('DISCORD_BOT_MISSING_PERMISSIONS_STAGE');
						return;
					}
					if (interaction.guild.members.cache.get(interaction.client.user.id).isCommunicationDisabled()) {
						await interaction.replyHandler.localeError('DISCORD_BOT_TIMED_OUT');
						return;
					}

					await interaction.deferUpdate();
					const resolvedTracks = [];
					for (const track of tracks) {
						const results = await interaction.client.music.rest.loadTracks(track);
						if (results.loadType === 'TRACK_LOADED') {
							resolvedTracks.push(results.tracks[0]);
						}
					}
					let msg, extras = [];
					if (resolvedTracks.length === 1) {
						msg = 'MUSIC_QUEUE_ADDED';
						extras = [resolvedTracks[0].info.title, resolvedTracks[0].info.uri];
					}
					else {
						msg = 'MUSIC_QUEUE_ADDED_MULTI';
						extras = [resolvedTracks.length, getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_SEARCH'), ''] ;
					}
					if (!player?.connected) {
						player = interaction.client.music.createPlayer(interaction.guildId);
						player.musicHandler = new MusicHandler(interaction.client, player);
						player.queue.channel = interaction.channel;
						await player.connect(interaction.member.voice.channelId, { deafened: true });
						// that kid left while we were busy bruh
						if (!interaction.member.voice.channelId) {
							await player.musicHandler.disconnect();
							await interaction.replyHandler.locale('DISCORD_INTERACTION_CANCELED', { components: [] }, interaction.user.id);
							return;
						}
						if (interaction.member?.voice.channel.type === 'GUILD_STAGE_VOICE' && !interaction.member?.voice.channel.stageInstance?.topic) {
							try {
								await interaction.member.voice.channel.createStageInstance({ topic: getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_STAGE_TOPIC'), privacyLevel: 'GUILD_ONLY' });
							}
							catch (err) {
								logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
							}
						}
					}

					const firstPosition = player.queue.tracks.length + 1;
					const endPosition = firstPosition + resolvedTracks.length - 1;
					player.queue.add(resolvedTracks, { requester: interaction.user.id });

					const started = player.playing || player.paused;
					await interaction.replyHandler.locale(msg, { footer: started ? `${getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MISC_POSITION')}: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : '', components: [] }, ...extras);
					if (!started) { await player.queue.start(); }
					const state = interaction.guild.members.cache.get(interaction.client.user.id).voice;
					if (state.channel.type === 'GUILD_STAGE_VOICE' && state.suppress) {
						await state.setSuppressed(false);
					}
				}
			}
		}
	},
};
