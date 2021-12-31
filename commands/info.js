const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, Permissions } = require('discord.js');
const { version } = require('../package.json');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../data.js');

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
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setTitle('Quaver')
					.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_INFO_DETAIL', interaction.client.generateInvite({ permissions: [Permissions.FLAGS.ADMINISTRATOR], scopes: ['bot', 'applications.commands'] }), version))
					.setColor(defaultColor)
					.setThumbnail(interaction.client.user.avatarURL({ format: 'png' })),
			],
		});
	},
};