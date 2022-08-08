import { EmbedBuilder } from 'discord.js';
import { defaultLocale, colors } from '#settings';
import { logger, data } from '#lib/util/common.js';
import { getLocale } from '#lib/util/util.js';

export default {
	name: 'cancel',
	/** @param {import('discord.js').ButtonInteraction & {replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		if (interaction.customId.split('_')[1] !== interaction.user.id) {
			await interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', {}, 'error');
			return;
		}
		try {
			await interaction.update({
				embeds: [
					new EmbedBuilder()
						.setDescription(getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'DISCORD.INTERACTION.CANCELED', interaction.user.id))
						.setColor(colors.neutral),
				],
				components: [],
			});
		}
		catch (err) {
			logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
		}
	},
};
