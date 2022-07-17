const _ = require('lodash');
const { logger, data } = require('../../shared.js');
const { bot } = require('../../main.js');
const PlayerHandler = require('../../classes/PlayerHandler.js');

module.exports = {
	name: 'connect',
	once: false,
	async execute() {
		logger.info({ message: 'Connected.', label: 'Lavalink' });
		for await (const [guildId, guildData] of data.guild.instance.iterator()) {
			if (_.get(guildData, 'settings.stay.enabled')) {
				const guild = bot.guilds.cache.get(guildId);
				const player = bot.music.createPlayer(guildId);
				player.handler = new PlayerHandler(bot, player);
				player.queue.channel = guild.channels.cache.get(_.get(guildData, 'settings.stay.text'));
				await player.connect(_.get(guildData, 'settings.stay.channel'), { deafened: true });
			}
		}
	},
};
