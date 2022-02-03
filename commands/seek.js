const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { msToTime, msToTimeString } = require('../functions.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../data.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('seek')
		.setDescription(getLocale(defaultLocale, 'CMD_SEEK_DESCRIPTION'))
		.addIntegerOption(option =>
			option
				.setName('newseek')
				.setDescription(getLocale(defaultLocale, 'CMD_SEEK_OPTION_TIME'))
				.setMinValue(0)
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const newseek = interaction.options.getInteger('newseek');
		const seekMilliseconds = newseek * 1000;
		const durationSeconds = player.queue.current.length / 1000;
		const seekTime = msToTime(seekMilliseconds);
		const seekString = msToTimeString(seekTime, true);
		const duration = msToTime(player.queue.current.length);
		const durationString = msToTimeString(duration, true);
		const durationTime = msToTimeString(duration);
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
		if (newseek > durationSeconds) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_SEEK_BEYOND_LENGTH', durationSeconds, durationTime))
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
		await player.seek(seekMilliseconds);
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_SEEK_SUCCESS', newseek, durationSeconds, seekString, durationString))
					.setColor(defaultColor),
			],
		});
	},
};
