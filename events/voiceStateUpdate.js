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
			// Quaver didn't leave the vc, but its voice state changes
			if ((oldState.suppress !== newState.suppress || oldState.serverMute !== newState.serverMute || oldState.serverDeaf !== newState.serverDeaf) && oldState.channelId === newState.channelId) return;
			/** Statements for when Quaver LEAVEs */
			// disconnected manually
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
			/** Statements for when Quaver JOINs */
			// channel is a voice channel
			if (newState.channel.type === 'GUILD_VOICE') {
				// check for connect, speak permission for voice channel
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
			// channel is a stage channel, and Quaver is suppressed
			// this also handles suppressing Quaver mid-track
			if (newState.channel.type === 'GUILD_STAGE_VOICE' && newState.suppress) {
				const permissions = bot.guilds.cache.get(guild.id).channels.cache.get(newState.channelId).permissionsFor(bot.user.id);
				// check for connect, speak permission for stage channel
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
			/** Statements for when Quaver MOVEs */
			// moved to a new vc that has no humans and 24/7 is disabled
			if (newState.channel.members.filter(m => !m.user.bot).size < 1 && !await data.guild.get(player.guildId, 'settings.stay.enabled')) {
				// nothing is playing so we just leave
				if (!player.queue.current || !player.playing && !player.paused) {
					if (await data.guild.get(player.guildId, 'settings.stay.enabled')) {
						await data.guild.set(player.guildId, 'settings.stay.enabled', false);
					}
					logger.info({ message: `[G ${player.guildId}] Disconnecting (alone)`, label: 'Quaver' });
					await player.handler.locale('MUSIC_ALONE_MOVED');
					await player.handler.disconnect();
					return;
				}
				// avoid pauseTimeout if 24/7 is enabled
				if (await data.guild.get(player.guildId, 'settings.stay.enabled')) return;
				// the bot was playing something - set pauseTimeout
				await player.pause();
				logger.info({ message: `[G ${player.guildId}] Setting pause timeout`, label: 'Quaver' });
				if (player.pauseTimeout) {
					clearTimeout(player.pauseTimeout);
				}
				player.pauseTimeout = setTimeout(p => {
					logger.info({ message: `[G ${p.guildId}] Disconnecting (inactivity)`, label: 'Quaver' });
					p.handler.locale('MUSIC_INACTIVITY');
					p.handler.disconnect();
				}, 300000, player);
				await player.handler.send(`${getLocale(await data.guild.get(player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_ALONE_WARNING')} ${getLocale(await data.guild.get(player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_INACTIVITY_WARNING', Math.floor(Date.now() / 1000) + 300)}`, { footer: getLocale(await data.guild.get(player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_ALONE_REJOIN') });
			}
			// moved to a new vc that has humans and pauseTimeout is set
			else if (newState.channel.members.filter(m => !m.user.bot).size >= 1 && player.pauseTimeout) {
				player.resume();
				clearTimeout(player.pauseTimeout);
				delete player.pauseTimeout;
				await player.handler.locale('MUSIC_ALONE_RESUMED');
				return;
			}
		}
		// other bots' voice state changes from any vc that has nothing to do with us
		if (oldState.member.user.bot) return;
		/** Statements for when a user JOINs or MOVEs */
		// user joined or moved to Quaver's vc, and pauseTimeout is set
		if (newState.channelId === player?.channelId && player?.pauseTimeout) {
			player.resume();
			if (player.pauseTimeout) {
				clearTimeout(player.pauseTimeout);
				delete player.pauseTimeout;
			}
			await player.handler.locale('MUSIC_ALONE_RESUMED');
			return;
		}
		// user from other vc that has nothing to do with us
		if (oldState.channelId !== player?.channelId) return;
		// user didn't leave the vc, but their voice state changes
		if (newState.channelId === oldState.channelId) return;
		/** Statements for when a user LEAVEs */
		// vc still has humans
		if (oldState.channel.members.filter(m => !m.user.bot).size >= 1) return;
		// avoid pauseTimeout if 24/7 is enabled
		if (await data.guild.get(guild.id, 'settings.stay.enabled')) return;
		// nothing is playing so we just leave
		if (!player.queue.current || !player.playing && !player.paused) {
			logger.info({ message: `[G ${player.guildId}] Disconnecting (alone)`, label: 'Quaver' });
			player.handler.locale('MUSIC_ALONE');
			await player.handler.disconnect();
			return;
		}
		// rare case where the bot sets pause timeout after setting timeout
		// another weird issue where pause timeout is set after stage ends
		if (player.timeout || !player.channelId) return;
		const voiceChannel = bot.guilds.cache.get(player.guildId).channels.cache.get(player.channelId);
		if (voiceChannel.type === 'GUILD_STAGE_VOICE' && !voiceChannel.stageInstance) return;
		// the bot was playing something - set pauseTimeout
		await player.pause();
		logger.info({ message: `[G ${player.guildId}] Setting pause timeout`, label: 'Quaver' });
		if (player.pauseTimeout) {
			clearTimeout(player.pauseTimeout);
		}
		player.pauseTimeout = setTimeout(p => {
			logger.info({ message: `[G ${p.guildId}] Disconnecting (inactivity)`, label: 'Quaver' });
			p.handler.locale('MUSIC_INACTIVITY');
			p.handler.disconnect();
		}, 300000, player);
		await player.handler.send(`${getLocale(await data.guild.get(player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_ALONE_WARNING')} ${getLocale(await data.guild.get(player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_INACTIVITY_WARNING', Math.floor(Date.now() / 1000) + 300)}`, { footer: getLocale(await data.guild.get(player.guildId, 'settings.locale') ?? defaultLocale, 'MUSIC_ALONE_REJOIN') });
	},
};
