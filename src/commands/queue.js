import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { checks } from '#lib/util/constants.js';
import { paginate, getLocale, msToTime, msToTimeString, getGuildLocale } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('queue')
		.setDescription(getLocale(defaultLocale, 'CMD.QUEUE.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.queue.tracks.length === 0) return interaction.replyHandler.locale('CMD.QUEUE.RESPONSE.QUEUE_EMPTY', { type: 'error' });
		const pages = paginate(player.queue.tracks, 5);
		return interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(
					pages[0].map((track, index) => {
						const duration = msToTime(track.length);
						const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
						return `\`${index + 1}.\` **[${track.title.length >= 50 ? `${track.title.substring(0, 47)}...` : track.title}](${track.uri})** \`[${durationString}]\` <@${track.requester}>`;
					}).join('\n'),
				)
				.setFooter({ text: await getGuildLocale(interaction.guildId, 'MISC.PAGE', '1', pages.length) }),
			{
				components: [
					new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setCustomId('queue_0')
								.setEmoji('⬅️')
								.setDisabled(true)
								.setStyle(ButtonStyle.Primary),
							new ButtonBuilder()
								.setCustomId('queue_goto')
								.setStyle(ButtonStyle.Secondary)
								.setLabel(await getGuildLocale(interaction.guildId, 'MISC.GO_TO')),
							new ButtonBuilder()
								.setCustomId('queue_2')
								.setEmoji('➡️')
								.setDisabled(pages.length === 1)
								.setStyle(ButtonStyle.Primary),
						),
				],
				ephemeral: true,
			},
		);
	},
};
