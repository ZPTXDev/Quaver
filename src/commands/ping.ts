import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { settings } from '#src/lib/util/settings.js';
import { msToTime, msToTimeString, getLocaleString, getGuildLocaleString, TimeObject } from '#src/lib/util/util.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';

export default {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.PING.DESCRIPTION')),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler }): Promise<void> {
		const uptime = msToTime(interaction.client.uptime);
		const uptimeString = msToTimeString(uptime);
		await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(await getGuildLocaleString(interaction.guildId, 'CMD.PING.RESPONSE.SUCCESS', interaction.guild ? ` ${interaction.guild.shard.ping}ms` : ''))
				.setFooter({ text: `${await getGuildLocaleString(interaction.guildId, 'CMD.PING.MISC.UPTIME')} ${uptimeString}` }),
			{ ephemeral: true },
		);
	},
};
