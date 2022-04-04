const { SlashCommandBuilder } = require('@discordjs/builders');
const { checks } = require('../enums.js');
const { defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../shared.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('disconnect')
		.setDescription(getLocale(defaultLocale, 'CMD_DISCONNECT_DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		if (guildData.get(`${interaction.guildId}.always.enabled`)) {
			await interaction.replyHandler.localeError('CMD_DISCONNECT_247_ENABLED');
			return;
		}
		const player = interaction.client.music.players.get(interaction.guildId);
		player.musicHandler.disconnect();
		await interaction.replyHandler.locale('CMD_DISCONNECT_SUCCESS');
	},
};
