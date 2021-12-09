const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { defaultColor } = require('../settings.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Check Quaver\'s latency and uptime.'),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		let totalSeconds = (interaction.client.uptime / 1000);
		const days = Math.floor(totalSeconds / 86400);
		totalSeconds %= 86400;
		const hours = Math.floor(totalSeconds / 3600);
		totalSeconds %= 3600;
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = Math.floor(totalSeconds % 60);
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(`Pong!${interaction.guild ? ` ${interaction.guild.shard.ping}ms` : ''}`)
					.setFooter(`Uptime: ${days} d ${hours} h ${minutes} m ${seconds} s`)
					.setColor(defaultColor),
			],
		});
	},
};
