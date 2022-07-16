const { logger } = require('../shared.js');

module.exports = {
	name: 'guildDelete',
	once: false,
	/** @param {import('discord.js').Guild} guild */
	async execute(guild) {
		const { bot } = require('../main.js');
		logger.info({ message: `[G ${guild.id}] Left guild ${guild.name}`, label: 'Discord' });
		const player = bot.music.players.get(guild.id);
		if (player) await player.handler.disconnect();
	},
};
