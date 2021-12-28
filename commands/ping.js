const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { msToTime, msToTimeString, getLocale } = require('../functions.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription(getLocale(defaultLocale, 'CMD_PING_DESCRIPTION')),
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
					.setDescription(`${getLocale(defaultLocale, 'CMD_PING_SUCCESS')}${interaction.guild ? ` ${interaction.guild.shard.ping}ms` : ''}`)
					.setFooter(`${getLocale(defaultLocale, 'CMD_PING_UPTIME')} ${uptimeString}`)
					.setColor(defaultColor),
			],
		});
	},
};
