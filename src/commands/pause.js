import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { getLocale } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('pause')
		.setDescription(getLocale(defaultLocale, 'CMD.PAUSE.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.paused) {
			await interaction.replyHandler.locale('CMD.PAUSE.RESPONSE.STATE_UNCHANGED', {}, 'error');
			return;
		}
		await player.pause();
		await interaction.replyHandler.locale('CMD.PAUSE.RESPONSE.SUCCESS', {}, 'success');
	},
};
