import { SlashCommandBuilder } from 'discord.js';
import { defaultLocaleCode, features } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocaleString } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('pause')
		.setDescription(getLocaleString(defaultLocaleCode, 'CMD.PAUSE.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const { io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.paused) return interaction.replyHandler.locale('CMD.PAUSE.RESPONSE.STATE_UNCHANGED', { type: 'error' });
		await player.pause();
		if (features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('pauseUpdate', player.paused);
		return interaction.replyHandler.locale('CMD.PAUSE.RESPONSE.SUCCESS', { type: 'success' });
	},
};
