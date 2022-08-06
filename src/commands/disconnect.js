const { SlashCommandBuilder } = require('discord.js');
const { defaultLocale } = require('#settings');
const { checks } = require('#lib/util/constants.js');
const { getLocale } = require('#lib/util/util.js');
const { data } = require('#lib/util/common.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('disconnect')
		.setDescription(getLocale(defaultLocale, 'CMD_DISCONNECT_DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
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
