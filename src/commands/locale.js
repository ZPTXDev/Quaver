import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { defaultLocale, colors } from '#settings';
import { checks } from '#lib/util/constants.js';
import { roundTo, getLocale, checkLocaleCompletion, getAbsoluteFileURL } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';
import fs from 'fs';

export default {
	data: new SlashCommandBuilder()
		.setName('locale')
		.setDescription(getLocale(defaultLocale, 'CMD.LOCALE.DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('new_locale')
				.setDescription(getLocale(defaultLocale, 'CMD.LOCALE.OPTION.NEW_LOCALE'))
				.setRequired(true)
				.addChoices(...fs.readdirSync(getAbsoluteFileURL(import.meta.url, ['..', '..', 'locales'])).map(file => { return { name: file, value: file }; })))
		.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
	checks: [checks.GUILD_ONLY],
	permissions: {
		user: [PermissionsBitField.Flags.ManageGuild],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const locale = interaction.options.getString('new_locale');
		const localeCompletion = checkLocaleCompletion(locale);
		if (localeCompletion === 'LOCALE_MISSING') {
			await interaction.replyHandler.reply('That locale does not exist.', {}, 'error');
			return;
		}
		await data.guild.set(interaction.guildId, 'settings.locale', locale);
		const additionalEmbed = localeCompletion.completion !== 100 ? [
			new EmbedBuilder()
				.setDescription(`This locale is incomplete. Completion: \`${roundTo(localeCompletion.completion, 2)}%\`\nMissing strings:\n\`\`\`\n${localeCompletion.missing.join('\n')}\`\`\``)
				.setColor(colors.warning),
		] : [];
		await interaction.replyHandler.locale('CMD.LOCALE.RESPONSE.SUCCESS', { additionalEmbeds: additionalEmbed }, 'success', interaction.guild.name, locale);
	},
};
