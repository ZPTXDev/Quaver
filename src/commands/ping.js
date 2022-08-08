import { SlashCommandBuilder } from 'discord.js';
import { defaultLocale } from '#settings';
import { msToTime, msToTimeString, getLocale } from '#lib/util/util.js';
import { data } from '#lib/util/common.js';

export default {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription(getLocale(defaultLocale, 'CMD.PING.DESCRIPTION')),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client, replyHandler: import('#lib/ReplyHandler.js')}} interaction */
	async execute(interaction) {
		const uptime = msToTime(interaction.client.uptime);
		const uptimeString = msToTimeString(uptime);
		await interaction.replyHandler.locale('CMD.PING.RESPONSE.SUCCESS', { footer: `${getLocale(await data.guild.get(interaction.guildId, 'settings.locale') ?? defaultLocale, 'CMD.PING.MISC.UPTIME')} ${uptimeString}` }, 'neutral', interaction.guild ? ` ${interaction.guild.shard.ping}ms` : '');
	},
};
