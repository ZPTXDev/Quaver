const { SlashCommandBuilder } = require('@discordjs/builders');
const { defaultLocale } = require('../settings.json');
const { msToTime, msToTimeString, getLocale } = require('../functions.js');
const { guildData } = require('../shared.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription(getLocale(defaultLocale, 'CMD_PING_DESCRIPTION')),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction) {
		const uptime = msToTime(interaction.client.uptime);
		const uptimeString = msToTimeString(uptime);
		await interaction.replyHandler.localeDefault('CMD_PING_PONG', { footer: `${getLocale(guildData.get(`${interaction.guildId}.locale`) ?? defaultLocale, 'CMD_PING_UPTIME')} ${uptimeString}` }, interaction.guild ? ` ${interaction.guild.shard.ping}ms` : '');
	},
};
