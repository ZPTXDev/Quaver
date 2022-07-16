const { Permissions } = require('discord.js');
const { logger, data } = require('../shared.js');
const { getLocale } = require('../functions.js');
const { bot } = require('../main.js');
const { defaultLocale } = require('../settings.json');

module.exports = {
	name: 'voiceStateUpdate',
	once: false,
	/**
	 * @param {import('discord.js').VoiceState} oldState
	 * @param {import('discord.js').VoiceState} newState
	 */
	async execute(oldState, newState) {
		const guild = oldState.guild;
		/** @type {import('lavaclient').Player & {handler: import('../classes/PlayerHandler.js')}} */
		const player = bot.music.players.get(guild.id);
		if (!player) return;
		// Quaver voiceStateUpdate
		if (oldState.member.user.id === bot.user.id) {
			// Quaver didn't leave the channel, but its voice state changed
			if ((oldState.suppress !== newState.suppress || oldState.serverMute !== newState.serverMute || oldState.serverDeaf !== newState.serverDeaf) && oldState.channelId === newState.channelId) return;
			/** Checks for when Quaver leaves */
			// Disconnected
			if (!newState.channelId) {
				logger.info({ message: `[G ${player.guildId}] Cleaning up`, label: 'Quaver' });
				player.channelId = null;
				if (await data.guild.get(player.guildId, 'settings.stay.enabled')) {
					await data.guild.set(player.guildId, 'settings.stay.enabled', false);
				}
				await player.handler.locale('MUSIC_FORCED');
				await player.handler.disconnect(oldState.channelId);
				return;
			}
			/** Checks for when Quaver joins */
			// Channel is a voice channel
			if (newState.channel.type === 'GUILD_VOICE') {
				// Check for connect, speak permission for voice channel
				const permissions = bot.guilds.cache.get(guild.id).channels.cache.get(newState.channelId).permissionsFor(bot.user.id);
				if (!permissions.has(['VIEW_CHANNEL', 'CONNECT', 'SPEAK'])) {
					await player.handler.locale('DISCORD_BOT_MISSING_PERMISSIONS_BASIC');
					await player.handler.disconnect();
					return;
				}
				if (await data.guild.get(player.guildId, 'settings.stay.enabled') && await data.guild.get(player.guildId, 'settings.stay.channel') !== newState.channelId) {
					await data.guild.set(player.guildId, 'settings.stay.channel', newState.channelId);
				}
			}
			// Channel is a stage channel, and Quaver is suppressed
			// This also handles suppressing Quaver mid-track
			if (newState.channel.type === 'GUILD_STAGE_VOICE' && newState.suppress) {
				const permissions = bot.guilds.cache.get(guild.id).channels.cache.get(newState.channelId).permissionsFor(bot.user.id);
				// Check for connect, speak permission for stage channel
				if (!permissions.has(['VIEW_CHANNEL', 'CONNECT', 'SPEAK'])) {
					await player.handler.locale('DISCORD_BOT_MISSING_PERMISSIONS_BASIC');
					await player.handler.disconnect();
					return;
				}
				if (!permissions.has(Permissions.STAGE_MODERATOR)) {
					if (await data.guild.get(player.guildId, 'settings.stay.enabled')) {
						await data.guild.set(player.guildId, 'settings.stay.enabled', false);
					}
					await player.handler.locale('MUSIC_FORCED_STAGE');
					await player.handler.disconnect();
					return;
				}
				await newState.setSuppressed(false);
				if (!newState.channel.stageInstance?.topic) {
					try {
						await newState.channel.createStageInstance({ topic: getLocale(await data.guild.get(player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_STAGE_TOPIC'), privacyLevel: 'GUILD_ONLY' });
					}
					catch (err) {
						logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
					}
				}
				if (await data.guild.get(player.guildId, 'settings.stay.enabled') && await data.guild.get(player.guildId, 'settings.stay.channel') !== newState.channelId) {
					await data.guild.set(player.guildId, 'settings.stay.channel', newState.channelId);
				}
			}
			/** Checks for when Quaver moves */
			// Moved to a new channel that has no humans and 24/7 is disabled
			if (newState.channel.members.filter(m => !m.user.bot).size < 1 && !await data.guild.get(player.guildId, 'settings.stay.enabled')) {
				// Nothing is playing so we'll leave
				if (!player.queue.current || !player.playing && !player.paused) {
					if (await data.guild.get(player.guildId, 'settings.stay.enabled')) {
						await data.guild.set(player.guildId, 'settings.stay.enabled', false);
					}
					logger.info({ message: `[G ${player.guildId}] Disconnecting (alone)`, label: 'Quaver' });
					await player.handler.locale('MUSIC_ALONE_MOVED');
					await player.handler.disconnect();
					return;
				}
				// Avoid pauseTimeout if 24/7 is enabled
				if (await data.guild.get(player.guildId, 'settings.stay.enabled')) return;
				// Quaver was playing something - set pauseTimeout
				await player.pause();
				logger.info({ message: `[G ${player.guildId}] Setting pause timeout`, label: 'Quaver' });
				// Ensure that the bot does not set a new pauseTimeout if pauseTimeout already exists
				if (player.pauseTimeout) return;
				// When setting a pauseTimeout, clear pauseTimeout at any cost as failsafe
				clearTimeout(player.pauseTimeout);
				player.pauseTimeout = setTimeout(p => {
					logger.info({ message: `[G ${p.guildId}] Disconnecting (inactivity)`, label: 'Quaver' });
					p.handler.locale('MUSIC_INACTIVITY');
					p.handler.disconnect();
				}, 300000, player);
				await player.handler.send(`${getLocale(await data.guild.get(player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_ALONE_WARNING')} ${getLocale(await data.guild.get(player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_INACTIVITY_WARNING', Math.floor(Date.now() / 1000) + 300)}`, { footer: getLocale(await data.guild.get(player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_ALONE_REJOIN') });
			}
			// Moved to a new channel that has humans and pauseTimeout is set
			else if (newState.channel.members.filter(m => !m.user.bot).size >= 1 && player.pauseTimeout) {
				player.resume();
				clearTimeout(player.pauseTimeout);
				delete player.pauseTimeout;
				await player.handler.locale('MUSIC_ALONE_RESUMED');
				return;
			}
		}
		// Other bots' voice state changed
		if (oldState.member.user.bot) return;
		// User voiceStateUpdate
		/** Checks for when a user joins or moves */
		// User joined or moved to Quaver's channel, and pauseTimeout is set
		if (newState.channelId === player?.channelId && player?.pauseTimeout) {
			player.resume();
			if (player.pauseTimeout) {
				clearTimeout(player.pauseTimeout);
				delete player.pauseTimeout;
			}
			await player.handler.locale('MUSIC_ALONE_RESUMED');
			return;
		}
		// User not in our channel
		if (oldState.channelId !== player?.channelId) return;
		// User didn't leave the channel, but their voice state changed
		if (newState.channelId === oldState.channelId) return;
		/** Checks for when a user leaves */
		// Channel still has humans
		if (oldState.channel.members.filter(m => !m.user.bot).size >= 1) return;
		// Avoid pauseTimeout if 24/7 is enabled
		if (await data.guild.get(guild.id, 'settings.stay.enabled')) return;
		// Nothing is playing so we'll leave
		if (!player.queue.current || !player.playing && !player.paused) {
			logger.info({ message: `[G ${player.guildId}] Disconnecting (alone)`, label: 'Quaver' });
			await player.handler.locale('MUSIC_ALONE');
			await player.handler.disconnect();
			return;
		}
		// Ensure that the bot does not set pauseTimeout if timeout already exists
		// Ensure that the bot does not set pauseTimeout after a stage ends
		if (player.timeout || !player.channelId) return;
		const voiceChannel = bot.guilds.cache.get(player.guildId).channels.cache.get(player.channelId);
		if (voiceChannel.type === 'GUILD_STAGE_VOICE' && !voiceChannel.stageInstance) return;
		// Quaver was playing something - set pauseTimeout
		await player.pause();
		logger.info({ message: `[G ${player.guildId}] Setting pause timeout`, label: 'Quaver' });
		// When setting a pauseTimeout, clear pauseTimeout at any cost as failsafe
		clearTimeout(player.pauseTimeout);
		player.pauseTimeout = setTimeout(p => {
			logger.info({ message: `[G ${p.guildId}] Disconnecting (inactivity)`, label: 'Quaver' });
			p.handler.locale('MUSIC_INACTIVITY');
			p.handler.disconnect();
		}, 300000, player);
		await player.handler.send(`${getLocale(await data.guild.get(player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_ALONE_WARNING')} ${getLocale(await data.guild.get(player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_INACTIVITY_WARNING', Math.floor(Date.now() / 1000) + 300)}`, { footer: getLocale(await data.guild.get(player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_ALONE_REJOIN') });
	},
};
