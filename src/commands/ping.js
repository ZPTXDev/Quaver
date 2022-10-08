import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { defaultLocaleCode } from '#settings';
import { msToTime, msToTimeString, getLocaleString, getGuildLocaleString } from '#lib/util/util.js';

export default {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription(getLocaleString(defaultLocaleCode, 'CMD.PING.DESCRIPTION')),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	/** @param {import('discord.js').ChatInputCommandInteraction & {client: import('discord.js').Client, replyHandler: import('#lib/ReplyHandler.js').default}} interaction */
	async execute(interaction) {
		const uptime = msToTime(interaction.client.uptime);
		const uptimeString = msToTimeString(uptime);
		return interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(await getGuildLocaleString(interaction.guildId, 'CMD.PING.RESPONSE.SUCCESS', interaction.guild ? ` ${interaction.guild.shard.ping}ms` : ''))
				.setFooter({ text: `${await getGuildLocaleString(interaction.guildId, 'CMD.PING.MISC.UPTIME')} ${uptimeString}` }),
			{ ephemeral: true },
		);
	},
};
