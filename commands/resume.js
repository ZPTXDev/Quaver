const { SlashCommandBuilder } = require('@discordjs/builders');
const { checks } = require('../enums.js');
const { defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('resume')
		.setDescription(getLocale(defaultLocale, 'CMD_RESUME_DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player.paused) {
			await interaction.replyHandler.localeErrorReply('CMD_RESUME_UNPAUSED');
			return;
		}
		player.resume();
		await interaction.replyHandler.localeReply('CMD_RESUME_SUCCESS');
	},
};
