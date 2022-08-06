const { SlashCommandBuilder } = require('discord.js');
const { defaultLocale } = require('#settings');
const { msToTime, msToTimeString, getLocale } = require('#lib/util/util.js');
const { data } = require('#lib/util/common.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription(getLocale(defaultLocale, 'CMD_PING_DESCRIPTION')),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const uptime = msToTime(interaction.client.uptime);
		const uptimeString = msToTimeString(uptime);
		await interaction.replyHandler.locale('CMD_PING_PONG', { footer: `${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'CMD_PING_UPTIME')} ${uptimeString}` }, 'neutral', interaction.guild ? ` ${interaction.guild.shard.ping}ms` : '');
	},
};
