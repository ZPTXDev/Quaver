const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { version } = require('#package');
const { defaultLocale } = require('#settings');
const { getLocale } = require('#lib/util/util.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription(getLocale(defaultLocale, 'CMD_INFO_DESCRIPTION')),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		await interaction.replyHandler.locale('CMD_INFO_DETAIL', { title: 'Quaver', thumbnail: interaction.client.user.avatarURL({ format: 'png' }) }, 'neutral', interaction.client.generateInvite({ permissions: [PermissionsBitField.Flags.Administrator], scopes: ['bot', 'applications.commands'] }), version);
	},
};
