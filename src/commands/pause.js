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
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.paused) {
			await interaction.replyHandler.locale('CMD.PAUSE.RESPONSE.STATE_UNCHANGED', {}, 'error');
			return;
		}
		player.pause();
		await interaction.replyHandler.locale('CMD.PAUSE.RESPONSE.SUCCESS', {}, 'success');
	},
};
