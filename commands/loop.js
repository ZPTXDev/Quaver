const { SlashCommandBuilder } = require('@discordjs/builders');
const { LoopType } = require('@lavaclient/queue');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../data.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('loop')
		.setDescription(getLocale(defaultLocale, 'CMD_LOOP_DESCRIPTION'))
		.addStringOption(option =>
			option
				.setName('type')
				.setDescription(getLocale(defaultLocale, 'CMD_LOOP_OPTION_TYPE'))
				.setRequired(true)
				.addChoice(getLocale(defaultLocale, 'CMD_LOOP_OPTION_TYPE_DISABLED'), 'disabled')
				.addChoice(getLocale(defaultLocale, 'CMD_LOOP_OPTION_TYPE_TRACK'), 'track')
				.addChoice(getLocale(defaultLocale, 'CMD_LOOP_OPTION_TYPE_QUEUE'), 'queue')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		const type = interaction.options.getString('type');
		let loop, typeLocale;
		switch (type) {
			case 'disabled':
				loop = LoopType.None;
				typeLocale = getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_LOOP_OPTION_TYPE_DISABLED');
				break;
			case 'track':
				loop = LoopType.Song;
				typeLocale = getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_LOOP_OPTION_TYPE_TRACK');
				break;
			case 'queue':
				loop = LoopType.Queue;
				typeLocale = getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_LOOP_OPTION_TYPE_QUEUE');
				break;
		}
		typeLocale = typeLocale.toLowerCase();
		player.queue.setLoop(loop);
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_LOOP_SUCCESS', typeLocale))
					.setColor(defaultColor),
			],
		});
	},
};
