const { Permissions } = require('discord.js');
const { logger, data } = require('../shared.js');
const { getLocale } = require('../functions.js');
const { checks } = require('../enums.js');
const { defaultLocale } = require('../settings.json');
const ReplyHandler = require('../classes/ReplyHandler.js');
const PlayerHandler = require('../classes/PlayerHandler.js');

module.exports = {
	name: 'interactionCreate',
	once: false,
	/** @param {import('discord.js').CommandInteraction & {replyHandler: ReplyHandler, client: import('discord.js').Client & {commands: import('discord.js').Collection, music: import('lavaclient').Node}}} interaction */
	async execute(interaction) {
		interaction.replyHandler = new ReplyHandler(interaction);
		if (interaction.isCommand()) {
			/** @type {{checks: string[]}} */
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
			const button = interaction.client.buttons.get(interaction.customId.split('_')[0]);
			if (!button) return;
			logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Processing button ${interaction.customId}`, label: 'Quaver' });
			try {
				logger.info({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Executing button ${interaction.customId}`, label: 'Quaver' });
				await button.execute(interaction);
			}
			catch (err) {
				logger.error({ message: `[${interaction.guildId ? `G ${interaction.guildId} | ` : ''}U ${interaction.user.id}] Encountered error with button ${interaction.customId}`, label: 'Quaver' });
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				await interaction.replyHandler.localeError('DISCORD_BUTTON_ERROR');
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
						extras = [resolvedTracks.length, getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_SEARCH'), ''] ;
					}
					if (!player?.connected) {
						player = interaction.client.music.createPlayer(interaction.guildId);
						player.handler = new PlayerHandler(interaction.client, player);
						player.queue.channel = interaction.channel;
						await player.connect(interaction.member.voice.channelId, { deafened: true });
						// that kid left while we were busy bruh
						if (!interaction.member.voice.channelId) {
							await player.handler.disconnect();
							await interaction.replyHandler.locale('DISCORD_INTERACTION_CANCELED', { components: [] }, interaction.user.id);
							return;
						}
						if (interaction.member?.voice.channel.type === 'GUILD_STAGE_VOICE' && !interaction.member?.voice.channel.stageInstance?.topic) {
							try {
								await interaction.member.voice.channel.createStageInstance({ topic: getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_STAGE_TOPIC'), privacyLevel: 'GUILD_ONLY' });
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
					await interaction.replyHandler.locale(msg, { footer: started ? `${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MISC_POSITION')}: ${firstPosition}${endPosition !== firstPosition ? ` - ${endPosition}` : ''}` : '', components: [] }, ...extras);
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
