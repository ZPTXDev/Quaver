import { ActionRowBuilder, EmbedBuilder, SelectMenuBuilder } from 'discord.js';
import { checkLocaleCompletion, getGuildLocaleString, getLocaleString, messageDataBuilder, roundTo, settingsPage } from '#lib/util/util.js';
import { confirmationTimeout, data, logger } from '#lib/util/common.js';
import { defaultLocale } from '#settings';
import { settingsOptions } from '#lib/util/constants.js';

export default {
	name: 'language',
	async execute(interaction) {
		if (interaction.message.interaction.user.id !== interaction.user.id) return interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
		if (!confirmationTimeout[interaction.message.id]) return interaction.replyHandler.locale('DISCORD.INTERACTION.EXPIRED', { components: [], force: 'update' });
		clearTimeout(confirmationTimeout[interaction.message.id]);
		confirmationTimeout[interaction.message.id] = setTimeout(async message => {
			try {
				await message.edit(
					messageDataBuilder(
						new EmbedBuilder()
							.setDescription(await getGuildLocaleString(message.guildId, 'DISCORD.INTERACTION.EXPIRED')),
						{ components: [] },
					),
				);
			}
			catch (err) {
				logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
			}
			delete confirmationTimeout[message.id];
		}, 30 * 1000, interaction.message);
		const option = interaction.values[0];
		const localeCompletion = checkLocaleCompletion(option);
		if (localeCompletion === 'LOCALE_MISSING') return interaction.replyHandler.reply('That language does not exist.', { type: 'error' });
		await data.guild.set(interaction.guildId, 'settings.locale', option);
		if (localeCompletion.completion !== 100) {
			await interaction.replyHandler.reply(
				new EmbedBuilder()
					.setDescription(`This language is incomplete. Completion: \`${roundTo(localeCompletion.completion, 2)}%\`\nMissing strings:\n\`\`\`\n${localeCompletion.missing.join('\n')}\`\`\``),
				{ type: 'warning', ephemeral: true },
			);
		}
		const guildLocale = await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale;
		const { current, embeds, actionRow } = await settingsPage(interaction, guildLocale, 'language');
		const description = `${getLocaleString(guildLocale, 'CMD.SETTINGS.RESPONSE.HEADER', interaction.guild.name)}\n\n**${getLocaleString(guildLocale, 'CMD.SETTINGS.MISC.LANGUAGE.NAME')}** ─ ${getLocaleString(guildLocale, 'CMD.SETTINGS.MISC.LANGUAGE.DESCRIPTION')}\n> ${getLocaleString(guildLocale, 'MISC.CURRENT')}: \`${current}\``;
		const args = [
			[description, ...embeds],
			{
				components: [
					new ActionRowBuilder()
						.addComponents(
							SelectMenuBuilder.from(interaction.message.components[0].components[0])
								.setOptions(
									settingsOptions.map(opt => ({ label: getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.NAME`), description: getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.DESCRIPTION`), value: opt, default: opt === 'language' })),
								),
						),
					actionRow,
				],
			},
		];
		return localeCompletion.completion !== 100
			? interaction.message.edit(messageDataBuilder(...args))
			: interaction.replyHandler.reply(args[0], { ...args[1], force: 'update' });
	},
};
