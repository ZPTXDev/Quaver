const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultLocale } = require('../settings.json');
const { roundTo, getLocale, checkLocaleCompletion } = require('../functions.js');
const { data } = require('../shared.js');
const fs = require('fs');
const path = require('path');
const { PermissionFlagsBits } = require('discord-api-types/v10');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('locale')
		.setDescription(getLocale(defaultLocale, 'CMD_LOCALE_DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('new_locale')
				.setDescription(getLocale(defaultLocale, 'CMD_LOCALE_OPTION_LOCALE'))
				.setRequired(true)
				.addChoices(...fs.readdirSync(path.resolve(__dirname, '../locales')).map(file => { return { name: file, value: file }; })))
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
	checks: [checks.GUILD_ONLY],
	permissions: {
		// TODO: when v14 is available, we'll replace this with PermissionFlagsBits
		user: ['MANAGE_GUILD'],
		bot: [],
	},
	async execute(interaction) {
		const locale = interaction.options.getString('new_locale');
		const localeCompletion = checkLocaleCompletion(locale);
		if (localeCompletion === 'LOCALE_MISSING') {
			await interaction.replyHandler.error('That locale does not exist.');
			return;
		}
		await data.guild.set(interaction.guildId, 'settings.locale', locale);
		const additionalEmbed = localeCompletion.completion !== 100 ? [
			new MessageEmbed()
				.setDescription(`This locale is incomplete. Completion: \`${roundTo(localeCompletion.completion, 2)}%\`\nMissing strings:\n\`\`\`\n${localeCompletion.missing.join('\n')}\`\`\``)
				.setColor('DARK_RED'),
		] : [];
		await interaction.replyHandler.locale('CMD_LOCALE_SUCCESS', { additionalEmbeds: additionalEmbed }, interaction.guild.name, locale);
	},
};
