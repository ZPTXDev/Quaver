import PlayerHandler from '#src/lib/PlayerHandler.js';
import { data, logger } from '#src/lib/util/common.js';
import { Queue } from '@lavaclient/queue';
import { TextChannel, VoiceChannel } from 'discord.js';
import { Node, Player } from 'lavaclient';
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
				const player: Player<Node> & { handler?: PlayerHandler; queue?: Queue & { channel?: TextChannel | VoiceChannel } } = bot.music.createPlayer(guildId);
				player.handler = new PlayerHandler(bot, player);
				player.queue.channel = <TextChannel | VoiceChannel> guild.channels.cache.get(get(guildData, 'settings.stay.text'));
				await player.connect(get(guildData, 'settings.stay.channel'), { deafened: true });
			}
		}
	},
};
