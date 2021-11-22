const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor } = require('../settings.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('clear')
		.setDescription('Clear the queue.'),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.queue.tracks.length === 0) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription('There are no tracks in the queue to clear.')
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		player.queue.clear();
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription('The queue has been cleared.')
					.setColor(defaultColor),
			],
		});
	},
};