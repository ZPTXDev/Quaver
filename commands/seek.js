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
				.setMaxValue(24))
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
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_SEEK_STREAM'))
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		const hoursInput = interaction.options.getInteger('hours');
		const minutesInput = interaction.options.getInteger('minutes');
		const secondsInput = interaction.options.getInteger('seconds');

		const hoursInputInMs = hoursInput * 3600000;
		const minutesInputInMs = minutesInput * 60000;
		const secondsInputInMs = secondsInput * 1000;

		const ms = hoursInputInMs + secondsInputInMs + minutesInputInMs;
		if (hoursInput === null && minutesInput === null && secondsInput === null && hoursInput !== 0) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_SEEK_OPTION_INVALID'))
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		const trackLengthInMs = player.queue.current.length;
		const duration = msToTime(trackLengthInMs);
		const durationString = msToTimeString(duration, true);
		if (ms > trackLengthInMs) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_SEEK_INVALID_POSITION', durationString))
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
