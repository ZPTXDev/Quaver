const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { token, defaultColor } = require('../settings.json');
const Discord = require('discord.js');
const client = new Discord.Client({ intents: [] })

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Check Quaver\'s latency and uptime.'),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	async execute (interaction) {
        let totalSeconds = (client.uptime / 1000);
        let days = Math.floor(totalSeconds / 86400);
        totalSeconds %= 86400;
        let hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        let minutes = Math.floor(totalSeconds / 60);
        let seconds = Math.floor(totalSeconds % 60);		
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
client.login(token);
