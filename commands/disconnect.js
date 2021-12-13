const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { checks } = require('../enums.js');
const { defaultColor } = require('../settings.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('disconnect')
		.setDescription('Disconnect Quaver.'),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const state = interaction.client.guilds.cache.get(interaction.guildId).members.cache.get(interaction.client.user.id).voice;
		if (state.channel.type === 'GUILD_STAGE_VOICE') {
			if (!state.suppress) {
				await state.setSuppressed(true);
			}
			if (state.channel.stageInstance?.topic === 'Music by Quaver') {
				await state.channel.stageInstance.delete();
			}
		}
		const player = interaction.client.music.players.get(interaction.guildId);
		clearTimeout(player.timeout);
		clearTimeout(player.pauseTimeout);
		player.disconnect();
		interaction.client.music.destroyPlayer(interaction.guildId);
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setDescription('Left the voice channel.')
					.setColor(defaultColor),
			],
		});
	},
};