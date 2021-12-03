const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor } = require('../settings.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bind')
		.setDescription('Change the text channel used by Quaver to send messages automatically.')
		.addChannelOption(option =>
			option
				.setName('channel')
				.setDescription('The text channel to bind to.')
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const channel = interaction.options.getChannel('channel');
		if (channel.type !== 'GUILD_TEXT') {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription('Please specify a valid text channel.')
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		player.queue.channel = channel;
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(`Bound to <#${channel.id}>`)
					.setColor(defaultColor),
			],
		});
	},
};