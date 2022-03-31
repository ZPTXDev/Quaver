const { MessageEmbed } = require('discord.js');
const { logger, guildData } = require('../../shared.js');
const { getLocale, msToTime, msToTimeString } = require('../../functions.js');
const { defaultLocale, defaultColor } = require('../../settings.json');
const { bot } = require('../../main.js');

module.exports = {
	name: 'trackStart',
	once: false,
	async execute(queue, track) {
		logger.info({ message: `[G ${queue.player.guildId}] Starting track`, label: 'Quaver' });
		queue.player.pause(false);
		if (queue.player.timeout) {
			clearTimeout(queue.player.timeout);
			delete queue.player.timeout;
		}
		const duration = msToTime(track.length);
		const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
		// check for permissions for text channel
		const botChannelPerms = bot.guilds.cache.get(queue.player.guildId).channels.cache.get(queue.player.channelId).permissionsFor(bot.user.id);
		if (!botChannelPerms.has(['VIEW_CHANNEL', 'SEND_MESSAGES'])) { return; }
		await queue.channel.send({
			embeds: [
				new MessageEmbed()
					.setDescription(`${getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_NOW_PLAYING', track.title, track.uri, durationString)}\n${getLocale(guildData.get(`${queue.player.guildId}.locale`) ?? defaultLocale, 'MUSIC_ADDED_BY', track.requester)}`)
					.setColor(defaultColor),
			],
		});
	},
};
