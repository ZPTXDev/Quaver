const { MessageEmbed } = require('discord.js');
const { logger, data } = require('../../shared.js');
const { getLocale } = require('../../functions.js');
const { defaultLocale, defaultColor } = require('../../settings.json');

module.exports = {
	name: 'cancel',
	/** @param {import('discord.js').ButtonInteraction & {replyHandler: import('../../classes/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		if (interaction.customId.split('_')[1] !== interaction.user.id) {
			await interaction.replyHandler.localeError('DISCORD_INTERACTION_WRONG_USER');
			return;
		}
		try {
			await interaction.update({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'DISCORD_INTERACTION_CANCELED', interaction.user.id))
						.setColor(defaultColor),
				],
				components: [],
			});
		}
		catch (err) {
			logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
		}
	},
};
