import { ActionRowBuilder, EmbedBuilder, SelectMenuBuilder } from 'discord.js';
import { getGuildLocaleString, getLocaleString, buildMessageOptions, settingsPage } from '#lib/util/util.js';
import { settingsOptions } from '#lib/util/constants.js';
import { confirmationTimeout, data, logger } from '#lib/util/common.js';
import { defaultLocaleCode } from '#settings';

export default {
	name: 'settings',
	async execute(interaction) {
		if (interaction.message.interaction.user.id !== interaction.user.id) return interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
		if (!confirmationTimeout[interaction.message.id]) return interaction.replyHandler.locale('DISCORD.INTERACTION.EXPIRED', { components: [], force: 'update' });
		clearTimeout(confirmationTimeout[interaction.message.id]);
		confirmationTimeout[interaction.message.id] = setTimeout(async message => {
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
		const guildLocale = await data.guild.get(interaction.guild.id, 'settings.locale') ?? defaultLocaleCode;
		const { current, embeds, actionRow } = await settingsPage(interaction, guildLocale, option);
		const description = `${getLocaleString(guildLocale, 'CMD.SETTINGS.RESPONSE.HEADER', interaction.guild.name)}\n\n**${getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${option.toUpperCase()}.NAME`)}** ─ ${getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${option.toUpperCase()}.DESCRIPTION`)}\n> ${getLocaleString(guildLocale, 'MISC.CURRENT')}: \`${current}\``;
		return interaction.replyHandler.reply(
			[description, ...embeds],
			{
				components: [
					new ActionRowBuilder()
						.addComponents(
							new SelectMenuBuilder()
								.setCustomId('settings')
								.addOptions(
									settingsOptions.map(opt => ({ label: getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.NAME`), description: getLocaleString(guildLocale, `CMD.SETTINGS.MISC.${opt.toUpperCase()}.DESCRIPTION`), value: opt, default: opt === option })),
								),
						),
					actionRow,
				],
				force: 'update',
			},
		);
	},
};
