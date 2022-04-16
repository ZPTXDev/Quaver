const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultLocale } = require('../settings.json');
const { roundTo, getLocale, checkLocaleCompletion } = require('../functions.js');
const { guildData } = require('../shared.js');
const fs = require('fs');
const path = require('path');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('locale')
		.setDescription(getLocale(defaultLocale, 'CMD_LOCALE_DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('new_locale')
				.setDescription(getLocale(defaultLocale, 'CMD_LOCALE_OPTION_LOCALE'))
				.setRequired(true)
				.addChoices(fs.readdirSync(path.resolve(__dirname, '../locales')).map(file => {return [file, file];}))),
	checks: [checks.GUILD_ONLY],
	permissions: {
		// TODO: https://msciotti.notion.site/msciotti/Command-Permissions-V2-4d113cb49090409f998f3bd80a06c3bd (when it gets released)
		user: ['MANAGE_GUILD'],
		bot: [],
	},
	async execute(interaction) {
		const locale = interaction.options.getString('new_locale');
		guildData.set(`${interaction.guildId}.locale`, locale);
		const localeCompletion = checkLocaleCompletion(locale);
		const additionalEmbed = localeCompletion.completion !== 100 ? [
			new MessageEmbed()
				.setDescription(`This locale is incomplete. Completion: \`${roundTo(localeCompletion.completion, 2)}%\`\nMissing strings:\n\`\`\`\n${localeCompletion.missing.join('\n')}\`\`\``)
				.setColor('DARK_RED'),
		] : [];
		await interaction.replyHandler.locale('CMD_LOCALE_SUCCESS', { additionalEmbeds: additionalEmbed }, interaction.guild.name, locale);
	},
};
