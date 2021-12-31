const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../data.js');
const fs = require('fs');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('locale')
		.setDescription(getLocale(defaultLocale, 'CMD_LOCALE_DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('locale')
				.setDescription(getLocale(defaultLocale, 'CMD_LOCALE_OPTION_LOCALE'))
				.setRequired(true)
				.addChoices(fs.readdirSync('../locales').filter(file => file.endsWith('.json')).map(file => {return { name: file.slice(0, -5), value: file.slice(0, -5) };}))),
	checks: [checks.GUILD_ONLY],
	permissions: {
		user: ['MANAGE_GUILD'],
		bot: [],
	},
	async execute(interaction) {
		const locale = interaction.options.getString('locale');
		guildData.set(`${interaction.guildId}.locale`, locale);
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_LOCALE_SUCCESS', interaction.guild.name, locale))
					.setColor(defaultColor),
			],
		});
	},
};