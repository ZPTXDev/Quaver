const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor } = require('../settings.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('skip')
		.setDescription('Skip the current track.'),
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
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(`Skipped **[${track.title}](${track.uri})**`)
						.setColor(defaultColor),
				],
			});
			return;
		}
		const skip = player.skip ?? { required: Math.ceil(interaction.member.voice.channel.members.size / 2), users: [] };
		if (skip.users.includes(interaction.user.id)) {
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription('You have already voted to skip this track.')
						.setColor('DARK_RED'),
				],
				ephemeral: true,
			});
			return;
		}
		skip.users.push(interaction.user.id);
		if (skip.users.length >= skip.required) {
			const track = await player.queue.skip();
			await player.queue.start();
			await interaction.reply({
				embeds: [
					new MessageEmbed()
						.setDescription(`Skipped **[${track.title}](${track.uri})** by voting\nAdded by <@${track.requester}>`)
						.setColor(defaultColor),
				],
			});
			await player.queue.next();
			return;
		}
		player.skip = skip;
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription(`Voted to skip **[${player.queue.current.title}](${player.queue.current.uri})** \`[${skip.users.length} / ${skip.required}]\``)
					.setColor(defaultColor),
			],
		});
	},
};