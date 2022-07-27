const { SlashCommandBuilder } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { data } = require('../shared.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('disconnect')
		.setDescription(getLocale(defaultLocale, 'CMD_DISCONNECT_DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('../classes/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		if (await data.guild.get(interaction.guildId, 'settings.stay.enabled')) {
			await interaction.replyHandler.locale('CMD_DISCONNECT_247_ENABLED', {}, 'error');
			return;
		}
		const player = interaction.client.music.players.get(interaction.guildId);
		await player.handler.disconnect();
		await interaction.replyHandler.locale('CMD_DISCONNECT_SUCCESS', {}, 'success');
	},
};
