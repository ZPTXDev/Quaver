import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { defaultLocale, colors } from '#settings';
import { checks } from '#lib/util/constants.js';
import { roundTo, getLocale, checkLocaleCompletion, getAbsoluteFileURL, getGuildLocale } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';
import fs from 'fs';

export default {
	data: new SlashCommandBuilder()
		.setName('language')
		.setDescription(getLocale(defaultLocale, 'CMD.LANGUAGE.DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('new_language')
				.setDescription(getLocale(defaultLocale, 'CMD.LANGUAGE.OPTION.NEW_LOCALE'))
				.setRequired(true)
				.addChoices(...fs.readdirSync(getAbsoluteFileURL(import.meta.url, ['..', '..', 'locales'])).map(file => { return { name: file, value: file }; })))
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
		if (localeCompletion === 'LOCALE_MISSING') return interaction.replyHandler.reply('That locale does not exist.', { type: 'error' });
		await data.guild.set(interaction.guildId, 'settings.locale', locale);
		const additionalEmbed = localeCompletion.completion !== 100 ? [
			new EmbedBuilder()
				.setDescription(`This locale is incomplete. Completion: \`${roundTo(localeCompletion.completion, 2)}%\`\nMissing strings:\n\`\`\`\n${localeCompletion.missing.join('\n')}\`\`\``)
				.setColor(colors.warning),
		] : [];
		return interaction.replyHandler.reply(
			[
				new EmbedBuilder()
					.setDescription(await getGuildLocale(interaction.guildId, 'CMD.LANGUAGE.RESPONSE.SUCCESS', interaction.guild.name, locale)),
				...additionalEmbed,
			],
			{ type: 'success' },
		);
	},
};
