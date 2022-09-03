import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale, features } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocaleString } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('resume')
		.setDescription(getLocaleString(defaultLocale, 'CMD.RESUME.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const { io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player.paused) return interaction.replyHandler.locale('CMD.RESUME.RESPONSE.STATE_UNCHANGED', { type: 'error' });
		await player.resume();
		if (!player.playing && player.queue.tracks.length > 0) await player.queue.start();
		if (features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('pauseUpdate', player.paused);
		return interaction.replyHandler.locale('CMD.RESUME.RESPONSE.SUCCESS', { type: 'success' });
	},
};
