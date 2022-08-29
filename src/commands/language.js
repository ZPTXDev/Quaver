import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { defaultLocale, colors } from '#settings';
import { checks, languageName } from '#lib/util/constants.js';
import { roundTo, getLocale, checkLocaleCompletion, getGuildLocale } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';

export default {
	data: new SlashCommandBuilder()
		.setName('language')
		.setDescription(getLocale(defaultLocale, 'CMD.LANGUAGE.DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('new_language')
				.setDescription(getLocale(defaultLocale, 'CMD.LANGUAGE.OPTION.NEW_LOCALE'))
				.setRequired(true)
				.setAutocomplete(true))
		.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
	checks: [checks.GUILD_ONLY],
	permissions: {
		user: [PermissionsBitField.Flags.ManageGuild],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const locale = interaction.options.getString('new_language');
		const localeCompletion = checkLocaleCompletion(locale);
		if (localeCompletion === 'LOCALE_MISSING') return interaction.replyHandler.reply('That language does not exist.', { type: 'error' });
		if (await data.guild.get(interaction.guild.id, 'settings.locale') === locale) return interaction.replyHandler.locale('CMD.LANGUAGE.RESPONSE.LANGUAGE_NOT_CHANGED', { args: [interaction.guild.name, `${languageName[locale] ?? 'Unknown'} (${locale})`], type: 'error' });
		await data.guild.set(interaction.guildId, 'settings.locale', locale);
		const additionalEmbed = localeCompletion.completion !== 100 ? [
			new EmbedBuilder()
				.setDescription(`This language is incomplete. Completion: \`${roundTo(localeCompletion.completion, 2)}%\`\nMissing strings:\n\`\`\`\n${localeCompletion.missing.join('\n')}\`\`\``)
				.setColor(colors.warning),
		] : [];
		return interaction.replyHandler.reply(
			[
				new EmbedBuilder()
					.setDescription(await getGuildLocale(interaction.guildId, 'CMD.LANGUAGE.RESPONSE.SUCCESS', interaction.guild.name, `${languageName[locale] ?? 'Unknown'} (${locale})`)),
				...additionalEmbed,
			],
			{ type: 'success' },
		);
	},
};
