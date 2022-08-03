const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checks } = require('../enums.js');
const { paginate, getLocale, msToTime, msToTimeString } = require('../functions.js');
const { defaultLocale } = require('../settings.json');
const { data } = require('../shared.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('queue')
		.setDescription(getLocale(defaultLocale, 'CMD_QUEUE_DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').CommandInteraction & {client: import('discord.js').Client & {music: import('lavaclient').Node}, replyHandler: import('../classes/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.queue.tracks.length === 0) {
			await interaction.replyHandler.locale('CMD_QUEUE_EMPTY', {}, 'error');
			return;
		}
		const pages = paginate(player.queue.tracks, 5);
		await interaction.replyHandler.reply(
			pages[0].map((track, index) => {
				const duration = msToTime(track.length);
				const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
				return `\`${index + 1}.\` **[${track.title}](${track.uri})** \`[${durationString}]\` <@${track.requester}>`;
			}).join('\n'),
			{
				footer: getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MISC_PAGE', '1', pages.length),
				components: [
					new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setCustomId('queue_0')
								.setEmoji('⬅️')
								.setDisabled(true)
								.setStyle(ButtonStyle.Primary),
							new ButtonBuilder()
								.setCustomId('queue_2')
								.setEmoji('➡️')
								.setDisabled(pages.length === 1)
								.setStyle(ButtonStyle.Primary),
							new ButtonBuilder()
								.setCustomId('queue_1')
								.setEmoji('🔁')
								.setStyle(ButtonStyle.Secondary)
								.setLabel(getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'MISC_REFRESH')),
						),
				],
			},
		);
	},
};
