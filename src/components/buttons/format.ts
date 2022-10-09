import type ReplyHandler from '#src/lib/ReplyHandler.js';
import { confirmationTimeout, data, logger } from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import { buildMessageOptions, getGuildLocaleString, getLocaleString, settingsPage } from '#src/lib/util/util.js';
import type { ButtonInteraction, MessageActionRowComponentBuilder, SelectMenuComponent } from 'discord.js';
import { ActionRowBuilder, EmbedBuilder, SelectMenuBuilder } from 'discord.js';

export default {
	name: 'format',
	async execute(interaction: ButtonInteraction & { replyHandler: ReplyHandler }): Promise<void> {
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
		const option = interaction.customId.split('_')[1];
		await data.guild.set(interaction.guildId, 'settings.format', option);
		// definitely need some checks here based on my own typedef, casting is not a good idea
		const guildLocaleCode = <string> await data.guild.get(interaction.guildId, 'settings.locale') ?? settings.defaultLocaleCode;
		const { current, embeds, actionRow } = await settingsPage(interaction, guildLocaleCode, 'format');
		const description = `${getLocaleString(guildLocaleCode, 'CMD.SETTINGS.RESPONSE.HEADER', interaction.guild.name)}\n\n**${getLocaleString(guildLocaleCode, 'CMD.SETTINGS.MISC.FORMAT.NAME')}** ─ ${getLocaleString(guildLocaleCode, 'CMD.SETTINGS.MISC.FORMAT.DESCRIPTION')}\n> ${getLocaleString(guildLocaleCode, 'MISC.CURRENT')}: \`${current}\``;
		await interaction.replyHandler.reply(
			[description, ...embeds],
			{
				components: [
					new ActionRowBuilder<SelectMenuBuilder>()
						.addComponents(SelectMenuBuilder.from(<SelectMenuComponent> interaction.message.components[0].components[0])),
					actionRow as ActionRowBuilder<MessageActionRowComponentBuilder>,
				],
				force: 'update',
			},
		);
	},
};
