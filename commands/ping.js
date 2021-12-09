const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { defaultColor } = require('../settings.json');
const { msToTime, msToTimeString } = require('../functions.js');
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
		const uptime = msToTime(interaction.client.uptime);
		const uptimeString = msToTimeString(uptime);
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(`Pong!${interaction.guild ? ` ${interaction.guild.shard.ping}ms` : ''}`)
					.setFooter(`Uptime: ${uptimeString}`)
					.setColor(defaultColor),
			],
		});
	},
};
