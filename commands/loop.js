const { SlashCommandBuilder } = require('@discordjs/builders');
const { LoopType } = require('@lavaclient/queue');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('loop')
		.setDescription('Loop the queue.')
		.addStringOption(option =>
			option
				.setName('type')
				.setDescription('The looping mode.')
				.setRequired(true)
				.addChoice('Disabled', 'disabled')
				.addChoice('Track', 'track')
				.addChoice('Queue', 'queue')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const type = interaction.options.getString('type');
		let loop;
		switch (type) {
			case 'disabled':
				loop = LoopType.None;
				break;
			case 'track':
				loop = LoopType.Song;
				break;
			case 'queue':
				loop = LoopType.Queue;
				break;
		}
		player.queue.setLoop(loop);
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(`Looping mode set to **${type}**`)
					.setColor('#f39bff'),
			],
		});
	},
};