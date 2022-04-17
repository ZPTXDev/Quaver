const { Permissions } = require('discord.js');
const { logger, guildData } = require('../shared.js');
const { getLocale } = require('../functions.js');
const { bot } = require('../main.js');
const { defaultLocale } = require('../settings.json');

module.exports = {
	name: 'voiceStateUpdate',
	once: false,
	async execute(oldState, newState) {
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
			if (!newState.channelId || !newState.channel?.members.find(m => m.user.id === bot.user.id)) {
				const oldVoiceChannel = oldState.channel;
				module.exports.oldVoiceChannel = oldVoiceChannel;
				logger.info({ message: `[G ${player.guildId}] Cleaning up`, label: 'Quaver' });
				if (guildData.get(`${player.guildId}.always.enabled`)) {
					guildData.set(`${player.guildId}.always.enabled`, false);
				}
				await player.musicHandler.locale('MUSIC_FORCED');
				player.musicHandler.disconnect();
				return;
			}
			// channel is a voice channel
			if (newState.channel.type === 'GUILD_VOICE') {
				// check for connect, speak permission for voice channel
				const permissions = bot.guilds.cache.get(guild.id).channels.cache.get(newState.channelId).permissionsFor(bot.user.id);
				if (!permissions.has(['VIEW_CHANNEL', 'CONNECT', 'SPEAK'])) {
					await player.musicHandler.locale('DISCORD_BOT_MISSING_PERMISSIONS_BASIC');
					player.musicHandler.disconnect();
					return;
				}
				if (guildData.get(`${player.guildId}.always.enabled`) && guildData.get(`${player.guildId}.always.channel`) !== newState.channelId) {
					guildData.set(`${player.guildId}.always.channel`, newState.channelId);
				}
			}
			// channel is a stage channel, and bot is suppressed
			// this also handles suppressing Quaver mid-track
			if (newState.channel.type === 'GUILD_STAGE_VOICE' && newState.suppress) {
				const permissions = bot.guilds.cache.get(guild.id).channels.cache.get(newState.channelId).permissionsFor(bot.user.id);
				// check for connect, speak permission for stage channel
				if (!permissions.has(['VIEW_CHANNEL', 'CONNECT', 'SPEAK'])) {
					await player.musicHandler.locale('DISCORD_BOT_MISSING_PERMISSIONS_BASIC');
					player.musicHandler.disconnect();
					return;
				}
				if (!permissions.has(Permissions.STAGE_MODERATOR)) {
					if (guildData.get(`${player.guildId}.always.enabled`)) {
						guildData.set(`${player.guildId}.always.enabled`, false);
					}
					await player.musicHandler.locale('MUSIC_FORCED_STAGE');
					player.musicHandler.disconnect();
					return;
				}
				await newState.setSuppressed(false);
				if (!newState.channel.stageInstance?.topic) {
					try {
						await newState.channel.createStageInstance({ topic: getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_STAGE_TOPIC'), privacyLevel: 'GUILD_ONLY' });
					}
					catch (err) {
						logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
					}
				}
				if (guildData.get(`${player.guildId}.always.enabled`) && guildData.get(`${player.guildId}.always.channel`) !== newState.channelId) {
					guildData.set(`${player.guildId}.always.channel`, newState.channelId);
				}
				return;
			}
			// the new vc has no humans
			if (newState.channel.members.filter(m => !m.user.bot).size < 1 && !guildData.get(`${player.guildId}.always.enabled`)) {
				// the bot is not playing anything - leave immediately
				if (!player.queue.current || !player.playing && !player.paused) {
					if (guildData.get(`${player.guildId}.always.enabled`)) {
						guildData.set(`${player.guildId}.always.enabled`, false);
					}
					logger.info({ message: `[G ${player.guildId}] Disconnecting (alone)`, label: 'Quaver' });
					await player.musicHandler.locale('MUSIC_ALONE_MOVED');
					player.musicHandler.disconnect();
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
					p.musicHandler.locale('MUSIC_INACTIVITY');
					p.musicHandler.disconnect();
				}, 300000, player);
				await player.musicHandler.send(`${getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ALONE_WARNING')} ${getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_INACTIVITY_WARNING', Math.floor(Date.now() / 1000) + 300)}`, { footer: getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ALONE_REJOIN') });
			}
			// the new vc has humans and pauseTimeout is set
			else if (newState.channel.members.filter(m => !m.user.bot).size >= 1 && player.pauseTimeout) {
				player.resume();
				clearTimeout(player.pauseTimeout);
				delete player.pauseTimeout;
				await player.musicHandler.locale('MUSIC_ALONE_RESUMED');
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
			await player.musicHandler.locale('MUSIC_ALONE_RESUMED');
			return;
		}
		// user has nothing to do with us
		if (oldState.channelId !== player?.channelId) return;
		// user didn't leave the vc
		if (newState.channelId === oldState.channelId) return;
		// vc still has people
		if (oldState.channel.members.filter(m => !m.user.bot).size >= 1) return;
		// player's gone!
		if (!player.connected) return;
		// 24/7 mode enabled, ignore
		if (guildData.get(`${guild.id}.always.enabled`)) return;
		// nothing is playing so we just leave
		if (!player.queue.current || !player.playing && !player.paused) {
			logger.info({ message: `[G ${player.guildId}] Disconnecting (alone)`, label: 'Quaver' });
			player.musicHandler.locale('MUSIC_ALONE');
			player.musicHandler.disconnect();
			return;
		}
		await player.pause();
		logger.info({ message: `[G ${player.guildId}] Setting pause timeout`, label: 'Quaver' });
		if (player.pauseTimeout) {
			clearTimeout(player.pauseTimeout);
		}
		player.pauseTimeout = setTimeout(p => {
			logger.info({ message: `[G ${p.guildId}] Disconnecting (inactivity)`, label: 'Quaver' });
			p.musicHandler.locale('MUSIC_INACTIVITY');
			p.musicHandler.disconnect();
		}, 300000, player);
		await player.musicHandler.send(`${getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ALONE_WARNING')} ${getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_INACTIVITY_WARNING', Math.floor(Date.now() / 1000) + 300)}`, { footer: getLocale(guildData.get(`${player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ALONE_REJOIN') });
	},
};
