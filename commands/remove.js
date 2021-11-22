const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor } = require('../settings.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('remove')
		.setDescription('Remove a track from the queue.')
		.addIntegerOption(option =>
			option
				.setName('position')
				.setDescription('The position of the track to remove.')
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const position = interaction.options.getInteger('position');
		if (player.queue.tracks.length === 0) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription('There are no tracks in the queue to remove.')
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		if (position < 1 || position > player.queue.tracks.length) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription('Please specify a valid index.')
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		if (player.queue.tracks[position - 1].requester !== interaction.user.id) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription('You are not the requester of that track.')
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		const track = player.queue.remove(position - 1);
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(`Removed **[${track.title}](${track.uri})**`)
					.setColor(defaultColor),
			],
		});
	},
};