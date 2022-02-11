const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale, msToTime, msToTimeString } = require('../functions.js');
const { guildData } = require('../data.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('seek')
		.setDescription(getLocale(defaultLocale, 'CMD_SEEK_DESCRIPTION'))
		.addIntegerOption(option =>
			option
				.setName('hours')
				.setDescription(getLocale(defaultLocale, 'CMD_SEEK_OPTION_HOURS'))
				.setMinValue(0)
				.setMaxValue(23))
		.addIntegerOption(option =>
			option
				.setName('minutes')
				.setDescription(getLocale(defaultLocale, 'CMD_SEEK_OPTION_MINUTES'))
				.setMinValue(0)
				.setMaxValue(59))
		.addIntegerOption(option =>
			option
				.setName('seconds')
				.setDescription(getLocale(defaultLocale, 'CMD_SEEK_OPTION_SECONDS'))
				.setMinValue(0)
				.setMaxValue(59)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player.queue.current || !player.playing && !player.paused) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_QUEUE_NOT_PLAYING'))
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		if (player.queue.current.isStream) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_SEEK_IS_STREAM'))
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		const hours = interaction.options.getInteger('hours') ?? 0, minutes = interaction.options.getInteger('minutes') ?? 0, seconds = interaction.options.getInteger('seconds') ?? 0;
		const ms = hours * 3600000 + minutes * 60000 + seconds * 1000;
		if (interaction.options.getInteger('hours') === null && interaction.options.getInteger('minutes') === null && interaction.options.getInteger('seconds') === null) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_SEEK_UNSPECIFIED_TIMESTAMP'))
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		const trackLength = player.queue.current.length;
		const duration = msToTime(trackLength);
		const durationString = msToTimeString(duration, true);
		if (ms > trackLength) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_SEEK_INVALID_TIMESTAMP', durationString))
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		const seekInput = msToTime(ms);
		const seekString = msToTimeString(seekInput, true);
		await player.seek(ms);
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_SEEK_SUCCESS', seekString, durationString))
					.setColor(defaultColor),
			],
		});
	},
};
