const { SlashCommandBuilder } = require('@discordjs/builders');
const { Permissions } = require('discord.js');
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
	async execute(interaction) {
		await interaction.replyHandler.localeReply('CMD_INFO_DETAIL', { title: 'Quaver', thumbnail: interaction.client.user.avatarURL({ format: 'png' }) }, interaction.client.generateInvite({ permissions: [Permissions.FLAGS.ADMINISTRATOR], scopes: ['bot', 'applications.commands'] }), version);
	},
};
