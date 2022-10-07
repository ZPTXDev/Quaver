import { ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { getGuildLocaleString, getLocaleString, buildMessageOptions, settingsPage } from '#lib/util/util.js';
import { confirmationTimeout, data, logger } from '#lib/util/common.js';
import { defaultLocaleCode } from '#settings';

export default {
	name: 'format',
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
		const option = interaction.customId.split('_')[1];
		await data.guild.set(interaction.guildId, 'settings.format', option);
		const guildLocaleCode = await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocaleCode;
		const { current, embeds, actionRow } = await settingsPage(interaction, guildLocaleCode, 'format');
		const description = `${getLocaleString(guildLocaleCode, 'CMD.SETTINGS.RESPONSE.HEADER', interaction.guild.name)}\n\n**${getLocaleString(guildLocaleCode, 'CMD.SETTINGS.MISC.FORMAT.NAME')}** ─ ${getLocaleString(guildLocaleCode, 'CMD.SETTINGS.MISC.FORMAT.DESCRIPTION')}\n> ${getLocaleString(guildLocaleCode, 'MISC.CURRENT')}: \`${current}\``;
		return interaction.replyHandler.reply(
			[description, ...embeds],
			{
				components: [
					new ActionRowBuilder()
						.addComponents(interaction.message.components[0].components[0]),
					actionRow,
				],
				force: 'update',
			},
		);
	},
};
