import { SlashCommandBuilder } from 'discord.js';
import { defaultLocaleCode, features } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocaleString } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('shuffle')
		.setDescription(getLocaleString(defaultLocaleCode, 'CMD.SHUFFLE.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const { bot, io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.queue.tracks.length <= 1) return interaction.replyHandler.locale('CMD.SHUFFLE.RESPONSE.QUEUE_INSUFFICIENT_TRACKS', { type: 'error' });
		let currentIndex = player.queue.tracks.length, randomIndex;
		while (currentIndex !== 0) {
			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex--;
			[player.queue.tracks[currentIndex], player.queue.tracks[randomIndex]] = [player.queue.tracks[randomIndex], player.queue.tracks[currentIndex]];
		}
		if (features.web.enabled) {
			io.to(`guild:${player.guildId}`).emit('queueUpdate', player.queue.tracks.map(t => {
				t.requesterTag = bot.users.cache.get(t.requester)?.tag;
				return t;
			}));
		}
		return interaction.replyHandler.locale('CMD.SHUFFLE.RESPONSE.SUCCESS', { type: 'success' });
	},
};
