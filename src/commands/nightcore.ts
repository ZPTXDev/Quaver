import { ChatInputCommandInteraction, Client, EmbedBuilder, SlashCommandBooleanOption, SlashCommandBuilder } from 'discord.js';
import { settings } from '#src/lib/util/settings.js';
import { checks } from '#src/lib/util/constants.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import { Node, Player } from 'lavaclient';

export default {
	data: new SlashCommandBuilder()
		.setName('nightcore')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.NIGHTCORE.DESCRIPTION'))
		.addBooleanOption((option): SlashCommandBooleanOption =>
			option
				.setName('enabled')
				.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.NIGHTCORE.OPTION.ENABLED'))),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const { io } = await import('#src/main.js');
		const player = <Player<Node> & { nightcore: boolean, bassboost: boolean }> interaction.client.music.players.get(interaction.guildId);
		const enabled = interaction.options.getBoolean('enabled');
		const nightcore = enabled !== null ? enabled : !player.nightcore;
		player.filters.timescale = nightcore ? { speed: 1.125, pitch: 1.125, rate: 1 } : undefined;
		await player.setFilters();
		player.nightcore = nightcore;
		if (settings.features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('filterUpdate', { bassboost: player.bassboost, nightcore: player.nightcore });
		await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(await getGuildLocaleString(interaction.guildId, player.nightcore ? 'CMD.NIGHTCORE.RESPONSE.ENABLED' : 'CMD.NIGHTCORE.RESPONSE.DISABLED'))
				.setFooter({ text: await getGuildLocaleString(interaction.guildId, 'MUSIC.PLAYER.FILTER_NOTE') }),
		);
	},
};
