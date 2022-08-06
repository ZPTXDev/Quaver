const { SlashCommandBuilder } = require('discord.js');
const { defaultLocale } = require('#settings');
const { checks } = require('#lib/util/constants.js');
const { getLocale } = require('#lib/util/util.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pause')
		.setDescription(getLocale(defaultLocale, 'CMD_PAUSE_DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.paused) {
			await interaction.replyHandler.locale('CMD_PAUSE_PAUSED', {}, 'error');
			return;
		}
		player.pause();
		await interaction.replyHandler.locale('CMD_PAUSE_SUCCESS', {}, 'success');
	},
};
