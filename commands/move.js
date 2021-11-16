const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('move')
		.setDescription('Move a track within the queue.')
		.addIntegerOption(option =>
			option
				.setName('oldposition')
				.setDescription('The position of the track to move.')
				.setRequired(true))
		.addIntegerOption(option =>
			option
				.setName('newposition')
				.setDescription('The new position to move the track to.')
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const oldposition = interaction.options.getInteger('oldposition');
		const newposition = interaction.options.getInteger('newposition');
		if (player.queue.tracks.length <= 1) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription('There aren\'t enough tracks in the queue to perform a move.')
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		if (oldposition < 1 || newposition < 1 || oldposition > player.queue.tracks.length || newposition > player.queue.tracks.length) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescriptiuon('One (or both) of your arguments are out of range.')
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		if (oldposition === newposition) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescriptiuon('Your arguments cannot be the same.')
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		player.queue.tracks.splice(newposition - 1, 0, player.queue.tracks.splice(oldposition - 1, 1)[0]);
		const track = player.queue.tracks[newposition - 1];
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(`Moved **[${track.title}](${track.uri})** \`${oldposition} -> ${newposition}\``)
					.setColor('#f39bff'),
			],
		});
	},
};