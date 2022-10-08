import { ActionRowBuilder, EmbedBuilder, MessageActionRowComponentBuilder, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction } from 'discord.js';
import { getGuildLocaleString, getLocaleString, messageDataBuilder, settingsPage } from '#src/lib/util/util.js';
import { settingsOptions } from '#src/lib/util/constants.js';
import { confirmationTimeout, data, logger } from '#src/lib/util/common.js';
import { defaultLocale } from '#src/settings.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';

export default {
	name: 'settings',
	async execute(interaction: SelectMenuInteraction & { replyHandler: ReplyHandler }): Promise<void> {
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
		const option = <'language' | 'format'> interaction.values[0];
		const guildLocale = <string> await data.guild.get(interaction.guild.id, 'settings.locale') ?? defaultLocale;
		const { current, embeds, actionRow } = await settingsPage(interaction, guildLocale, option);
		const description = `${getLocaleString(guildLocale, 'CMD.SETTINGS.RESPONSE.HEADER', interaction.guild.name)}\n\n**${getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${option.toUpperCase()}.NAME`)}** ─ ${getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${option.toUpperCase()}.DESCRIPTION`)}\n> ${getLocaleString(guildLocale, 'MISC.CURRENT')}: \`${current}\``;
		await interaction.replyHandler.reply(
			[description, ...embeds],
			{
				components: [
					new ActionRowBuilder<SelectMenuBuilder>()
						.addComponents(
							new SelectMenuBuilder()
								.setCustomId('settings')
								.addOptions(
									settingsOptions.map((opt): SelectMenuComponentOptionData => ({ label: getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.NAME`), description: getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.DESCRIPTION`), value: opt, default: opt === option })),
								),
						),
					actionRow as ActionRowBuilder<MessageActionRowComponentBuilder>,
				],
				force: 'update',
			},
		);
	},
};
