const { EmbedBuilder } = require('discord.js');
const { defaultLocale, colors } = require('#settings');
const { logger, data } = require('#lib/util/common.js');
const { getLocale } = require('#lib/util/util.js');

module.exports = {
	name: 'cancel',
	/** @param {import('discord.js').ButtonInteraction & {replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		if (interaction.customId.split('_')[1] !== interaction.user.id) {
			await interaction.replyHandler.locale('DISCORD_INTERACTION_WRONG_USER', {}, 'error');
			return;
		}
		try {
			await interaction.update({
				embeds: [
					new EmbedBuilder()
						.setDescription(getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'DISCORD_INTERACTION_CANCELED', interaction.user.id))
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
