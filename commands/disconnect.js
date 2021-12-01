const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor } = require('../settings.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('disconnect')
		.setDescription('Disconnect Quaver.'),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		clearTimeout(player.timeout);
		player.disconnect();
		interaction.client.music.destroyPlayer(interaction.guildId);
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription('Left the voice channel.')
					.setColor(defaultColor),
			],
		});
	},
};