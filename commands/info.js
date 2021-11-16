const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, Permissions } = require('discord.js');
const { version } = require('../package.json');

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
					.setDescription(`A music bot, part of the ZapSquared Network.\nSource code available [here](https://github.com/zapteryx/Quaver), invite [here](${interaction.client.generateInvite({ permissions: [Permissions.FLAGS.ADMINISTRATOR], scopes: ['bot', 'applications.commands'] })}).\nRunning version \`${version}\`.`)
					.setColor('#f39bff')
					.setThumbnail(interaction.client.user.avatarURL({ format: 'png' })),
			],
		});
	},
};