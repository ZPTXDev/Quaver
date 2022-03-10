const { SlashCommandBuilder } = require('@discordjs/builders');
const { Embed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../data.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('remove')
		.setDescription(getLocale(defaultLocale, 'CMD_REMOVE_DESCRIPTION'))
		.addIntegerOption(option =>
			option
				.setName('position')
				.setDescription(getLocale(defaultLocale, 'CMD_REMOVE_OPTION_POSITION'))
				.setMinValue(1)
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
					new Embed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_REMOVE_EMPTY'))
						.setColor('DarkRed'),
				],
				ephemeral: true,
			});
			return;
		}
		if (position > player.queue.tracks.length) {
			await interaction.reply({
				embeds: [
					new Embed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CHECK_INVALID_INDEX'))
						.setColor('DarkRed'),
				],
				ephemeral: true,
			});
			return;
		}
		if (player.queue.tracks[position - 1].requester !== interaction.user.id) {
			await interaction.reply({
				embeds: [
					new Embed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CHECK_NOT_REQUESTER'))
						.setColor('DarkRed'),
				],
				ephemeral: true,
			});
			return;
		}
		const track = player.queue.remove(position - 1);
		await interaction.reply({
			embeds: [
				new Embed()
					.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_REMOVE_SUCCESS', track.title, track.uri))
					.setColor(defaultColor),
			],
		});
	},
};