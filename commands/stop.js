const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor } = require('../settings.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stop')
		.setDescription('Stop the current track and clear the queue.'),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		player.queue.clear();
		await player.queue.skip();
		await player.queue.start();
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription('Stopped the current track and cleared the queue successfully.')
					.setColor(defaultColor),
			],
		});
	},
};