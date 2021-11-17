const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('nightcore')
		.setDescription('Nightcore mode speeds up your music.')
		.addBooleanOption(option =>
			option
				.setName('enabled')
				.setDescription('Whether or not nightcore will be enabled. If not specified, it will be toggled.')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const enabled = interaction.options.getBoolean('enabled');
		let nightcore;
		if (enabled !== null) {
			nightcore = enabled;
		}
		else {
			nightcore = !player.nightcore;
		}
		player.filters.timescale = nightcore ? { speed: 1.125, pitch: 1.125, rate: 1 } : undefined;
		await player.setFilters();
		player.nightcore = nightcore;
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(`Nightcore **${player.nightcore ? 'enabled' : 'disabled'}**`)
					.setFooter('This may take a few seconds to apply')
					.setColor('#f39bff'),
			],
		});
	},
};