import PlayerHandler from '#src/lib/PlayerHandler.js';
import { data, logger } from '#src/lib/util/common.js';
import type { QuaverChannels, QuaverClient, QuaverPlayer } from '#src/lib/util/common.types.js';
import { get } from 'lodash-es';

export default {
	name: 'connect',
	once: false,
	async execute(): Promise<void> {
		const { bot } = await import('#src/main.js');
		logger.info({ message: 'Connected.', label: 'Lavalink' });
		for await (const [guildId, guildData] of data.guild.instance.iterator()) {
			if (get(guildData, 'settings.stay.enabled')) {
				const guild = bot.guilds.cache.get(guildId);
				if (!guild) continue;
				const player = bot.music.createPlayer(guildId) as QuaverPlayer;
				player.handler = new PlayerHandler(bot as QuaverClient, player);
				player.queue.channel = guild.channels.cache.get(get(guildData, 'settings.stay.text')) as QuaverChannels;
				await player.connect(get(guildData, 'settings.stay.channel'), { deafened: true });
			}
		}
	},
};
