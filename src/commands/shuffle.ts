import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getLocaleString } from '#src/lib/util/util.js';
import type { Song } from '@lavaclient/queue';
import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('shuffle')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.SHUFFLE.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: QuaverInteraction<ChatInputCommandInteraction>): Promise<void> {
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
		if (settings.features.web.enabled) {
			io.to(`guild:${player.guildId}`).emit('queueUpdate', player.queue.tracks.map((t: Song & { requesterTag: string }): Song & { requesterTag: string } => {
				t.requesterTag = bot.users.cache.get(t.requester)?.tag;
				return t;
			}));
		}
		await interaction.replyHandler.locale('CMD.SHUFFLE.RESPONSE.SUCCESS', { type: 'success' });
	},
};
