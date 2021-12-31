const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../data.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('move')
		.setDescription(getLocale(defaultLocale, 'CMD_MOVE_DESCRIPTION'))
		.addIntegerOption(option =>
			option
				.setName('oldposition')
				.setDescription(getLocale(defaultLocale, 'CMD_MOVE_OPTION_OLDPOSITION'))
				.setRequired(true))
		.addIntegerOption(option =>
			option
				.setName('newposition')
				.setDescription(getLocale(defaultLocale, 'CMD_MOVE_OPTION_NEWPOSITION'))
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
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_MOVE_INSUFFICIENT'))
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
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_MOVE_NOT_IN_RANGE'))
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
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_MOVE_EQUAL'))
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
					.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_MOVE_SUCCESS', track.title, track.uri, oldposition, newposition))
					.setColor(defaultColor),
			],
		});
	},
};