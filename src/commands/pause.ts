import { ChatInputCommandInteraction, Client, SlashCommandBuilder } from 'discord.js';
import { settings } from '#src/lib/util/settings.js';
import { checks } from '#src/lib/util/constants.js';
import { getLocaleString } from '#src/lib/util/util.js';
import ReplyHandler from '#src/lib/ReplyHandler.js';
import { Node } from 'lavaclient';

export default {
	data: new SlashCommandBuilder()
		.setName('pause')
		.setDescription(getLocaleString(settings.defaultLocaleCode, 'CMD.PAUSE.DESCRIPTION')),
	checks: [checks.GUILD_ONLY, checks.ACTIVE_SESSION, checks.IN_VOICE, checks.IN_SESSION_VOICE],
	permissions: {
		user: [],
		bot: [],
	},
	async execute(interaction: ChatInputCommandInteraction & { replyHandler: ReplyHandler, client: Client & { music: Node } }): Promise<void> {
		const { io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		if (player.paused) {
			await interaction.replyHandler.locale('CMD.PAUSE.RESPONSE.STATE_UNCHANGED', { type: 'error' });
			return;
		}
		await player.pause();
		if (settings.features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('pauseUpdate', player.paused);
		await interaction.replyHandler.locale('CMD.PAUSE.RESPONSE.SUCCESS', { type: 'success' });
	},
};
