import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString, msToTime, msToTimeString } from '#src/lib/util/util.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.PING.DESCRIPTION')),
	checks: [],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: QuaverInteraction<ChatInputCommandInteraction>): Promise<void> {
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
