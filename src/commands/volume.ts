import { ChatInputCommandInteraction, Client, EmbedBuilder, SlashCommandBuilder, SlashCommandIntegerOption } from 'discord.js';
import { defaultLocaleCode, features, managers } from '#src/settings.js';
import { checks } from '#src/lib/util/constants.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import { Node } from 'lavaclient';

export default {
	data: new SlashCommandBuilder()
		.setName('volume')
		.setDescription(getLocaleString(defaultLocaleCode, 'CMD.VOLUME.DESCRIPTION'))
		.addIntegerOption((option): SlashCommandIntegerOption =>
			option
				.setName('new_volume')
				.setDescription(getLocaleString(defaultLocaleCode, 'CMD.VOLUME.OPTION.NEW_VOLUME'))
				.setMinValue(0)
				.setMaxValue(1000)
				.setRequired(true)),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const { io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		const volume = interaction.options.getInteger('new_volume');
		if (volume > 200 && !managers.includes(interaction.user.id)) {
			await interaction.replyHandler.locale('CMD.VOLUME.RESPONSE.OUT_OF_RANGE', { type: 'error' });
			return;
		}
		await player.setVolume(volume);
		if (features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('volumeUpdate', volume);
		await interaction.replyHandler.reply(
			new EmbedBuilder()
				.setDescription(await getGuildLocaleString(interaction.guildId, 'CMD.VOLUME.RESPONSE.SUCCESS', volume.toString()))
				.setFooter({ text: await getGuildLocaleString(interaction.guildId, 'MUSIC.PLAYER.FILTER_NOTE') }),
		);
	},
};
