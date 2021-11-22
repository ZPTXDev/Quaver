const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, Permissions } = require('discord.js');
const { version } = require('../package.json');
const { defaultColor } = require('../settings.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription('Show information about Quaver.'),
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
					.setDescription(`Open-source music bot for small communities.\nSource code available [here](https://go.zptx.icu/Quaver), invite [here](${interaction.client.generateInvite({ permissions: [Permissions.FLAGS.ADMINISTRATOR], scopes: ['bot', 'applications.commands'] })}).\nRunning version \`${version}\`.`)
					.setColor(defaultColor)
					.setThumbnail(interaction.client.user.avatarURL({ format: 'png' })),
			],
		});
	},
};