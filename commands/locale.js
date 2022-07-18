const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, Colors } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultLocale } = require('../settings.json');
const { roundTo, getLocale, checkLocaleCompletion } = require('../functions.js');
const { data } = require('../shared.js');
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
				.addChoices(...fs.readdirSync(path.resolve(__dirname, '../locales')).map(file => { return { name: file, value: file }; })))
		.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
	checks: [checks.GUILD_ONLY],
	permissions: {
		user: [PermissionsBitField.Flags.ManageGuild],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client, replyHandler: import('../classes/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const locale = interaction.options.getString('new_locale');
		const localeCompletion = checkLocaleCompletion(locale);
		if (localeCompletion === 'LOCALE_MISSING') {
			await interaction.replyHandler.error('That locale does not exist.');
			return;
		}
		await data.guild.set(interaction.guildId, 'settings.locale', locale);
		const additionalEmbed = localeCompletion.completion !== 100 ? [
			new EmbedBuilder()
				.setDescription(`This locale is incomplete. Completion: \`${roundTo(localeCompletion.completion, 2)}%\`\nMissing strings:\n\`\`\`\n${localeCompletion.missing.join('\n')}\`\`\``)
				.setColor(Colors.DarkRed),
		] : [];
		await interaction.replyHandler.locale('CMD_LOCALE_SUCCESS', { additionalEmbeds: additionalEmbed }, interaction.guild.name, locale);
	},
};
