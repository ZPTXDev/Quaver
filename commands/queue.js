const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { checks } = require('../enums.js');
const { paginate, msToTime, msToTimeString } = require('../functions.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../shared.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('queue')
		.setDescription(getLocale(defaultLocale, 'CMD_QUEUE_DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const pages = paginate(player.queue.tracks, 5);
		if (player.queue.tracks.length === 0) {
			await interaction.replyHandler.localeError('CMD_QUEUE_EMPTY');
			return;
		}
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(pages[0].map((track, index) => {
						const duration = msToTime(track.length);
						const durationString = track.isStream ? '∞' : msToTimeString(duration, true);
						return `\`${index + 1}.\` **[${track.title}](${track.uri})** \`[${durationString}]\` <@${track.requester}>`;
					}).join('\n'))
					.setColor(defaultColor)
					.setFooter({ text: getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'PAGE', '1', pages.length) }),
			],
			components: [
				new MessageActionRow()
					.addComponents(
						new MessageButton()
							.setCustomId('queue_0')
							.setEmoji('⬅️')
							.setDisabled(true)
							.setStyle('PRIMARY'),
						new MessageButton()
							.setCustomId('queue_2')
							.setEmoji('➡️')
							.setDisabled(pages.length === 1)
							.setStyle('PRIMARY'),
						new MessageButton()
							.setCustomId('queue_1')
							.setEmoji('🔁')
							.setStyle('SECONDARY')
							.setLabel(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'REFRESH')),
					),
			],
		});
	},
};
