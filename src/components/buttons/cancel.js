import { EmbedBuilder } from 'discord.js';
import { colors } from '#settings';
import { logger } from '#lib/util/common.js';
import { getGuildLocale } from '#lib/util/util.js';

export default {
	name: 'cancel',
	/** @param {import('discord.js').ButtonInteraction & {replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		if (interaction.customId.split('_')[1] !== interaction.user.id) return interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', {}, 'error');
		try {
			return await interaction.update({
				embeds: [
					new EmbedBuilder()
						.setDescription(await getGuildLocale(interaction.guildId, 'DISCORD.INTERACTION.CANCELED', interaction.user.id))
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
