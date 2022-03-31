const { MessageEmbed } = require('discord.js');
const { logger, guildData } = require('../../shared.js');
const { getLocale } = require('../../functions.js');
const { defaultLocale, defaultColor } = require('../../settings.json');
const { bot } = require('../../main.js');

module.exports = {
	name: 'queueFinish',
	once: false,
	execute(queue) {
		if (guildData.get(`${queue.player.guildId}.always.enabled`)) {
			// check for permissions for text channel
			const botChannelPerms = bot.guilds.cache.get(queue.player.guildId).channels.cache.get(queue.player.channelId).permissionsFor(bot.user.id);
			if (!botChannelPerms.has(['VIEW_CHANNEL', 'SEND_MESSAGES'])) { return; }
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
			// check for permissions for text channel
			const botChannelPerms = bot.guilds.cache.get(p.guildId).channels.cache.get(p.channelId).permissionsFor(bot.user.id);
			if (!botChannelPerms.has(['VIEW_CHANNEL', 'SEND_MESSAGES'])) { return; }
			channel.send({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${p.guildId}.locale`) ?? defaultLocale, 'MUSIC_INACTIVITY'))
						.setColor(defaultColor),
				],
			});
		}, 1800000, queue.player);
		// check for permissions for text channel
		const botChannelPerms = bot.guilds.cache.get(queue.player.guildId).channels.cache.get(queue.player.channelId).permissionsFor(bot.user.id);
		if (!botChannelPerms.has(['VIEW_CHANNEL', 'SEND_MESSAGES'])) { return; }
		queue.channel.send({
			embeds: [
				new MessageEmbed()
					.setDescription(`${getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_QUEUE_EMPTY')} ${getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_INACTIVITY_WARNING', Math.floor(Date.now() / 1000) + 1800)}`)
					.setColor(defaultColor),
			],
		});
	},
};
