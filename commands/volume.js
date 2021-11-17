const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { managers } = require('../settings.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('volume')
		.setDescription('Adjust the volume of Quaver.')
		.addIntegerOption(option =>
			option
				.setName('newvolume')
				.setDescription('The new volume to adjust to.')
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const newvolume = interaction.options.getInteger('newvolume');
		if (newvolume < 0 || (newvolume > 200 && !managers.includes(interaction.user.id))) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription('That is not within the valid range of `0%` to `200%`.')
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		await player.setVolume(newvolume);
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(`Volume adjusted to \`${newvolume}%\``)
					.setFooter('This may take a few seconds to apply')
					.setColor('#f39bff'),
			],
		});
	},
};