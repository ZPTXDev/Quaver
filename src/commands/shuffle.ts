import { ChatInputCommandInteraction, Client, SlashCommandBuilder } from 'discord.js';
import { defaultLocale, features } from '#src/settings.js';
import { checks } from '#src/lib/util/constants.js';
import { getLocaleString } from '#src/lib/util/util.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import { Node } from 'lavaclient';
import { Song } from '@lavaclient/queue';

export default {
	data: new SlashCommandBuilder()
		.setName('shuffle')
		.setDescription(getLocaleString(defaultLocale, 'CMD.SHUFFLE.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const { bot, io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.queue.tracks.length <= 1) {
			await interaction.replyHandler.locale('CMD.SHUFFLE.RESPONSE.QUEUE_INSUFFICIENT_TRACKS', { type: 'error' });
			return;
		}
		let currentIndex = player.queue.tracks.length, randomIndex;
		while (currentIndex !== 0) {
			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex--;
			[player.queue.tracks[currentIndex], player.queue.tracks[randomIndex]] = [player.queue.tracks[randomIndex], player.queue.tracks[currentIndex]];
		}
		if (features.web.enabled) {
			io.to(`guild:${player.guildId}`).emit('queueUpdate', player.queue.tracks.map((t: Song & { requesterTag: string }): Song & { requesterTag: string } => {
				t.requesterTag = bot.users.cache.get(t.requester)?.tag;
				return t;
			}));
		}
		await interaction.replyHandler.locale('CMD.SHUFFLE.RESPONSE.SUCCESS', { type: 'success' });
	},
};
