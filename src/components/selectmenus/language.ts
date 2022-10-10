import { confirmationTimeout, data, logger } from '#src/lib/util/common.js';
import type { MessageOptionsBuilderInputs, MessageOptionsBuilderOptions, QuaverInteraction } from '#src/lib/util/common.types.js';
import { settingsOptions } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { buildMessageOptions, checkLocaleCompletion, getGuildLocaleString, getLocaleString, roundTo, settingsPage } from '#src/lib/util/util.js';
import type { MessageActionRowComponentBuilder, SelectMenuComponent, SelectMenuComponentOptionData, SelectMenuInteraction } from 'discord.js';
import { ActionRowBuilder, EmbedBuilder, SelectMenuBuilder } from 'discord.js';

export default {
	name: 'language',
	async execute(interaction: QuaverInteraction<SelectMenuInteraction>): Promise<void> {
		if (interaction.message.interaction.user.id !== interaction.user.id) {
			await interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
			return;
		}
		if (!confirmationTimeout[interaction.message.id]) {
			await interaction.replyHandler.locale('DISCORD.INTERACTION.EXPIRED', { components: [], force: 'update' });
			return;
		}
		clearTimeout(confirmationTimeout[interaction.message.id]);
		confirmationTimeout[interaction.message.id] = setTimeout(async (message): Promise<void> => {
			try {
				await message.edit(
					buildMessageOptions(
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
		if (localeCompletion === 'LOCALE_MISSING') {
			await interaction.replyHandler.reply('That language does not exist.', { type: 'error' });
			return;
		}
		await data.guild.set(interaction.guildId, 'settings.locale', option);
		if (localeCompletion.completion !== 100) {
			await interaction.replyHandler.reply(
				new EmbedBuilder()
					.setDescription(`This language is incomplete. Completion: \`${roundTo(localeCompletion.completion, 2)}%\`\nMissing strings:\n\`\`\`\n${localeCompletion.missing.join('\n')}\`\`\``),
				{ type: 'warning', ephemeral: true },
			);
		}
		const guildLocaleCode = await data.guild.get<string>(interaction.guildId, 'settings.locale') ?? settings.defaultLocaleCode;
		const { current, embeds, actionRow } = await settingsPage(interaction, guildLocaleCode, 'language');
		const description = `${getLocaleString(guildLocaleCode, 'CMD.SETTINGS.RESPONSE.HEADER', interaction.guild.name)}\n\n**${getLocaleString(guildLocaleCode, 'CMD.SETTINGS.MISC.LANGUAGE.NAME')}** ─ ${getLocaleString(guildLocaleCode, 'CMD.SETTINGS.MISC.LANGUAGE.DESCRIPTION')}\n> ${getLocaleString(guildLocaleCode, 'MISC.CURRENT')}: \`${current}\``;
		const args: [MessageOptionsBuilderInputs, MessageOptionsBuilderOptions] = [
			[description, ...embeds],
			{
				components: [
					new ActionRowBuilder<SelectMenuBuilder>()
						.addComponents(
							SelectMenuBuilder.from(<SelectMenuComponent> interaction.message.components[0].components[0])
								.setOptions(
									settingsOptions.map((opt): SelectMenuComponentOptionData => ({ label: getLocaleString(guildLocaleCode, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.NAME`), description: getLocaleString(guildLocaleCode, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.DESCRIPTION`), value: opt, default: opt === 'language' })),
								),
						),
					actionRow as ActionRowBuilder<MessageActionRowComponentBuilder>,
				],
			},
		];
		localeCompletion.completion !== 100
			? await interaction.message.edit(buildMessageOptions(...args))
			: await interaction.replyHandler.reply(args[0], { ...args[1], force: 'update' });
	},
};
