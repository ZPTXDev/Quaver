const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bassboost')
		.setDescription('Boost the bass levels in your music.')
		.addBooleanOption(option =>
			option
				.setName('enabled')
				.setDescription('Whether or not bass boost will be enabled. If not specified, it will be toggled.')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const enabled = interaction.options.getBoolean('enabled');
		let boost;
		if (enabled !== null) {
			boost = enabled;
		}
		else {
			boost = !player.bassboost;
		}
		let eqValues = new Array(15).fill(0);
		if (boost) {
			eqValues = [0.2, 0.15, 0.1, 0.05, 0.0, ...new Array(10).fill(-0.05)];
		}
		await player.setEqualizer(eqValues);
		player.bassboost = boost;
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(`Bass boost **${player.bassboost ? 'enabled' : 'disabled'}**`)
					.setFooter('This may take a few seconds to apply')
					.setColor('#f39bff'),
			],
		});
	},
};