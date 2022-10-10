import { confirmationTimeout } from '#src/lib/util/common.js';
import type { QuaverInteraction } from '#src/lib/util/common.types.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import type { ButtonInteraction } from 'discord.js';
import { GuildMember } from 'discord.js';

export default {
	name: 'clear',
	async execute(interaction: QuaverInteraction<ButtonInteraction>): Promise<void> {
		if (interaction.message.interaction.user.id !== interaction.user.id) {
			await interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
			return;
		}
		const { io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player) {
			await interaction.replyHandler.locale(checks.ACTIVE_SESSION, { type: 'error' });
			return;
		}
		if (!(interaction.member instanceof GuildMember) || !interaction.member?.voice.channelId) {
			await interaction.replyHandler.locale(checks.IN_VOICE, { type: 'error' });
			return;
		}
		if (player && interaction.member?.voice.channelId !== player.channelId) {
			await interaction.replyHandler.locale(checks.IN_SESSION_VOICE, { type: 'error' });
			return;
		}
		clearTimeout(confirmationTimeout[interaction.message.id]);
		delete confirmationTimeout[interaction.message.id];
		if (player.queue.tracks.length === 0) {
			await interaction.replyHandler.locale('CMD.CLEAR.RESPONSE.QUEUE_EMPTY', { type: 'error', components: [], force: 'update' });
			return;
		}
		player.queue.clear();
		if (settings.features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('queueUpdate', []);
		await interaction.replyHandler.locale('CMD.CLEAR.RESPONSE.SUCCESS', { type: 'success', components: [], force: 'update' });
	},
};
