import { ButtonBuilder, ButtonStyle, EmbedBuilder, ActionRowBuilder } from 'discord.js';
import { paginate, msToTime, msToTimeString, getGuildLocale } from '#lib/util/util.js';

export default {
	name: 'queue',
	/** @param {import('discord.js').ButtonInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId), page = parseInt(interaction.fields.getTextInputValue('queue_goto_input'));
		let pages;
		if (isNaN(page)) return interaction.replyHandler.locale('CMD.QUEUE.RESPONSE.OUT_OF_RANGE', { type: 'error' });
		if (player) pages = paginate(player.queue.tracks, 5);
		if (!player) {
			const original = interaction.message.components;
			original[0].components = original[0].components.map(c => ButtonBuilder.from(c).setDisabled(true));
			original[1].components = original[1].components.map(c => ButtonBuilder.from(c).setDisabled(true));
			return interaction.update({ components: original });
		}
		if (page < 1 || page > pages.length) return interaction.replyHandler.locale('CMD.QUEUE.RESPONSE.OUT_OF_RANGE', { type: 'error' });
		const firstIndex = 5 * (page - 1) + 1;
		const pageSize = pages[page - 1].length;
		const largestIndexSize = (firstIndex + pageSize - 1).toString().length;
		const original = { embeds: interaction.message.embeds, components: interaction.message.components };
		if (original.embeds.length === 0) return interaction.message.delete();
		original.embeds[0] = EmbedBuilder.from(original.embeds[0])
			.setDescription(pages[page - 1].map((track, index) => {
				const duration = msToTime(track.length);
				const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
				return `\`${(firstIndex + index).toString().padStart(largestIndexSize, ' ')}.\` **[${track.title.length >= 50 ? `${track.title.substring(0, 47)}...` : track.title}](${track.uri})** \`[${durationString}]\` <@${track.requester}>`;
			}).join('\n'))
			.setFooter({ text: await getGuildLocale(interaction.guildId, 'MISC.PAGE', page, pages.length) });
		original.components[0] = ActionRowBuilder.from(original.components[0]);
		original.components[0].components = [];
		original.components[0].components[0] = new ButtonBuilder()
			.setCustomId(`queue_${page - 1}`)
			.setEmoji('⬅️')
			.setDisabled(page - 1 < 1)
			.setStyle(ButtonStyle.Primary);
		original.components[0].components[1] = new ButtonBuilder()
			.setCustomId('queue_goto')
			.setStyle(ButtonStyle.Secondary)
			.setLabel(await getGuildLocale(interaction.guildId, 'MISC.GO_TO')),
		original.components[0].components[2] = new ButtonBuilder()
			.setCustomId(`queue_${page + 1}`)
			.setEmoji('➡️')
			.setDisabled(page + 1 > pages.length)
			.setStyle(ButtonStyle.Primary);
		return interaction.replyHandler.reply(original.embeds, { components: original.components, force: 'update' });
	},
};
