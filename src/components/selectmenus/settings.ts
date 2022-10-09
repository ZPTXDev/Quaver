import ReplyHandler from '#src/lib/ReplyHandler.js';
import { confirmationTimeout, data, logger } from '#src/lib/util/common.js';
import { settingsOptions } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { buildMessageOptions, getGuildLocaleString, getLocaleString, settingsPage } from '#src/lib/util/util.js';
import { ActionRowBuilder, EmbedBuilder, MessageActionRowComponentBuilder, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction } from 'discord.js';

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
		const option = <'language' | 'format'> interaction.values[0];
		const guildLocaleCode = <string> await data.guild.get(interaction.guild.id, 'settings.locale') ?? settings.defaultLocaleCode;
		const { current, embeds, actionRow } = await settingsPage(interaction, guildLocaleCode, option);
		const description = `${getLocaleString(guildLocaleCode, 'CMD.SETTINGS.RESPONSE.HEADER', interaction.guild.name)}\n\n**${getLocaleString(guildLocaleCode, `CMD.SETTINGS.MISC.${option.toUpperCase()}.NAME`)}** ─ ${getLocaleString(guildLocaleCode, `CMD.SETTINGS.MISC.${option.toUpperCase()}.DESCRIPTION`)}\n> ${getLocaleString(guildLocaleCode, 'MISC.CURRENT')}: \`${current}\``;
		await interaction.replyHandler.reply(
			[description, ...embeds],
			{
				components: [
					new ActionRowBuilder<SelectMenuBuilder>()
						.addComponents(
							new SelectMenuBuilder()
								.setCustomId('settings')
								.addOptions(
									settingsOptions.map((opt): SelectMenuComponentOptionData => ({ label: getLocaleString(guildLocaleCode, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.NAME`), description: getLocaleString(guildLocaleCode, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.DESCRIPTION`), value: opt, default: opt === option })),
								),
						),
					actionRow as ActionRowBuilder<MessageActionRowComponentBuilder>,
				],
				force: 'update',
			},
		);
	},
};
