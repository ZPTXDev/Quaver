import { ButtonBuilder, ButtonStyle, EmbedBuilder, ActionRowBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { logger, data } from '#lib/util/common.js';
import { getLocale, paginate, msToTime, msToTimeString } from '#lib/util/util.js';

export default {
	name: 'queue',
	/** @param {import('discord.js').ButtonInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		let pages, page;
		if (player) {
			pages = paginate(player.queue.tracks, 5);
			page = parseInt(interaction.customId.split('_')[1]);
		}
		if (!player || page < 1 || page > pages.length) {
			const original = interaction.message.components;
			original[0].components = original[0].components.map(c => ButtonBuilder.from(c).setDisabled(true));
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
		original.embeds[0] = EmbedBuilder.from(original.embeds[0])
			.setDescription(pages[page - 1].map((track, index) => {
				const duration = msToTime(track.length);
				const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
				return `\`${(firstIndex + index).toString().padStart(largestIndexSize, ' ')}.\` **[${track.title}](${track.uri})** \`[${durationString}]\` <@${track.requester}>`;
			}).join('\n'))
			.setFooter({ text: getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MISC.PAGE', page, pages.length) });
		original.components[0] = ActionRowBuilder.from(original.components[0]);
		original.components[0].components = [];
		original.components[0].components[0] = new ButtonBuilder()
			.setCustomId(`queue_${page - 1}`)
			.setEmoji('⬅️')
			.setDisabled(page - 1 < 1)
			.setStyle(ButtonStyle.Primary);
		original.components[0].components[1] = new ButtonBuilder()
			.setCustomId(`queue_${page + 1}`)
			.setEmoji('➡️')
			.setDisabled(page + 1 > pages.length)
			.setStyle(ButtonStyle.Primary);
		original.components[0].components[2] = new ButtonBuilder()
			.setCustomId(`queue_${page}`)
			.setEmoji('🔁')
			.setStyle(ButtonStyle.Secondary)
			.setLabel(getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MISC.REFRESH'));
		try {
			await interaction.update({
				embeds: original.embeds,
				components: original.components,
			});
		}
		catch (err) {
			logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
		}
	},
};
