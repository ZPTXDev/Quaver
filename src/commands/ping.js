import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { msToTime, msToTimeString, getLocale, getGuildLocale } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription(getLocale(defaultLocale, 'CMD.PING.DESCRIPTION')),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const uptime = msToTime(interaction.client.uptime);
		const uptimeString = msToTimeString(uptime);
		return interaction.replyHandler.locale('CMD.PING.RESPONSE.SUCCESS', { footer: `${await getGuildLocale(interaction.guildId, 'CMD.PING.MISC.UPTIME')} ${uptimeString}` }, 'neutral', interaction.guild ? ` ${interaction.guild.shard.ping}ms` : '');
	},
};
