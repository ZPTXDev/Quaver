const { MessageEmbed } = require('discord.js');
const { logger, guildData } = require('../../shared.js');
const { getLocale } = require('../../functions.js');
const { defaultLocale, defaultColor } = require('../../settings.json');
const { bot } = require('../../main.js');

module.exports = {
	name: 'trackEnd',
	once: false,
	async execute(queue, track, reason) {
		delete queue.player.skip;
		if (reason === 'LOAD_FAILED') {
			logger.warn({ message: `[G ${queue.player.guildId}] Track skipped with reason: ${reason}`, label: 'Quaver' });
			// check for permissions for text channel
			const botChannelPerms = bot.guilds.cache.get(queue.player.guildId).channels.cache.get(queue.channel.id).permissionsFor(bot.user.id);
			if (!botChannelPerms.has(['VIEW_CHANNEL', 'SEND_MESSAGES'])) { return; }
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
			// check for permissions for text channel
			const botChannelPerms = bot.guilds.cache.get(queue.player.guildId).channels.cache.get(queue.channel.id).permissionsFor(bot.user.id);
			if (!botChannelPerms.has(['VIEW_CHANNEL', 'SEND_MESSAGES'])) { return; }
			queue.channel.send({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ALONE'))
						.setColor(defaultColor),
				],
			});
			return;
		}
	},
};
