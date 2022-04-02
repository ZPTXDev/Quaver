const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor, defaultLocale } = require('../settings.json');
const { getLocale } = require('../functions.js');
const { guildData } = require('../shared.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('skip')
		.setDescription(getLocale(defaultLocale, 'CMD_SKIP_DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.queue.current.requester === interaction.user.id) {
			const track = await player.queue.skip();
			await player.queue.start();
			await interaction.replyHandler.locale('CMD_SKIP_SUCCESS', {}, track.title, track.uri);
			return;
		}
		const skip = player.skip ?? { required: Math.ceil(interaction.member.voice.channel.members.size / 2), users: [] };
		if (skip.users.includes(interaction.user.id)) {
			await interaction.replyHandler.localeError('CMD_SKIP_VOTED');
			return;
		}
		skip.users.push(interaction.user.id);
		if (skip.users.length >= skip.required) {
			const track = await player.queue.skip();
			await player.queue.start();
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(`${getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_SKIP_SUCCESS_VOTED', track.title, track.uri)}\n${getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'MUSIC_ADDED_BY', track.requester)}`)
						.setColor(defaultColor),
				],
			});
			await player.queue.next();
			return;
		}
		player.skip = skip;
		await interaction.replyHandler.locale('CMD_SKIP_VOTED_SUCCESS', {}, player.queue.current.title, player.queue.current.uri, skip.users.length, skip.required);
	},
};
