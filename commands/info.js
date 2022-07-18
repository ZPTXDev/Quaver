const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { version } = require('../package.json');
const { defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription(getLocale(defaultLocale, 'CMD_INFO_DESCRIPTION')),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client, replyHandler: import('../classes/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		await interaction.replyHandler.locale('CMD_INFO_DETAIL', { title: 'Quaver', thumbnail: interaction.client.user.avatarURL({ format: 'png' }) }, interaction.client.generateInvite({ permissions: [PermissionsBitField.Flags.Administrator], scopes: ['bot', 'applications.commands'] }), version);
	},
};
