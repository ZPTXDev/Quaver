import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('resume')
		.setDescription(getLocale(defaultLocale, 'CMD.RESUME.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player.paused) {
			await interaction.replyHandler.locale('CMD.RESUME.RESPONSE.STATE_UNCHANGED', {}, 'error');
			return;
		}
		await player.resume();
		if (!player.playing && player.queue.tracks.length > 0) { await player.queue.start(); }
		await interaction.replyHandler.locale('CMD.RESUME.RESPONSE.SUCCESS', {}, 'success');
	},
};
