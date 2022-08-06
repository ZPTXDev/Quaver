import { get } from 'lodash';
import { logger, data } from '#lib/util/common.js';
import { bot } from '#src/main.js';
import PlayerHandler from '#lib/PlayerHandler.js';

export default {
	name: 'connect',
	once: false,
	async execute() {
		logger.info({ message: 'Connected.', label: 'Lavalink' });
		for await (const [guildId, guildData] of data.guild.instance.iterator()) {
			if (get(guildData, 'settings.stay.enabled')) {
				const guild = bot.guilds.cache.get(guildId);
				if (!guild) continue;
				const player = bot.music.createPlayer(guildId);
				player.handler = new PlayerHandler(bot, player);
				player.queue.channel = guild.channels.cache.get(get(guildData, 'settings.stay.text'));
				await player.connect(get(guildData, 'settings.stay.channel'), { deafened: true });
			}
		}
	},
};
