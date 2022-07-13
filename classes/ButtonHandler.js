const { MessageEmbed, MessageButton } = require('discord.js');
const { logger, data } = require('../shared.js');
const { getLocale, paginate, msToTime, msToTimeString } = require('../functions.js');
const { defaultLocale, defaultColor } = require('../settings.json');

module.exports = class ButtonHandler {

	async execute(interaction) {
		const type = interaction.customId.split('_')[0];
		switch (type) {
			case 'queue': {
				const player = interaction.client.music.players.get(interaction.guildId);
				let pages, page;
				if (player) {
					pages = paginate(player.queue.tracks, 5);
					page = parseInt(interaction.customId.split('_')[1]);
				}
				if (!player || page < 1 || page > pages.length) {
					const original = interaction.message.components;
					original[0].components.forEach(c => c.setDisabled(true));
					await interaction.update({
						components: original,
					});
					return;
				}
				const firstIndex = 5 * (page - 1) + 1;
				const pageSize = pages[page - 1].length;
				const largestIndexSize = (firstIndex + pageSize - 1).toString().length;
				const original = { embeds: interaction.message.embeds, components: interaction.message.components };
				if (original.embeds.length === 0) {
					await interaction.message.delete();
					return;
				}
				original.embeds[0]
					.setDescription(pages[page - 1].map((track, index) => {
						const duration = msToTime(track.length);
						const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
						return `\`${(firstIndex + index).toString().padStart(largestIndexSize, ' ')}.\` **[${track.title}](${track.uri})** \`[${durationString}]\` <@${track.requester}>`;
					}).join('\n'))
					.setFooter({ text: getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MISC_PAGE', page, pages.length) });
				original.components[0].components = [];
				original.components[0].components[0] = new MessageButton()
					.setCustomId(`queue_${page - 1}`)
					.setEmoji('⬅️')
					.setDisabled(page - 1 < 1)
					.setStyle('PRIMARY');
				original.components[0].components[1] = new MessageButton()
					.setCustomId(`queue_${page + 1}`)
					.setEmoji('➡️')
					.setDisabled(page + 1 > pages.length)
					.setStyle('PRIMARY');
				original.components[0].components[2] = new MessageButton()
					.setCustomId(`queue_${page}`)
					.setEmoji('🔁')
					.setStyle('SECONDARY')
					.setLabel(getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MISC_REFRESH'));
				try {
					await interaction.update({
						embeds: original.embeds,
						components: original.components,
					});
				}
				catch (err) {
					logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
				}
				break;
			}
			case 'cancel':
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
				break;
		}
	}
};
