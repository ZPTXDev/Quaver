import { checks } from '#lib/util/constants.js';
import { features } from '#settings';

export default {
	name: 'clear',
	async execute(interaction) {
		if (interaction.message.interaction.user.id !== interaction.user.id) return interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
		const { io } = await import('#src/main.js');
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player) return interaction.replyHandler.locale(checks.ACTIVE_SESSION, { type: 'error' });
		if (!interaction.member?.voice.channelId) return interaction.replyHandler.locale(checks.IN_VOICE, { type: 'error' });
		if (player && interaction.member?.voice.channelId !== player.channelId) return interaction.replyHandler.locale(checks.IN_SESSION_VOICE, { type: 'error' });
		if (player.queue.tracks.length === 0) return interaction.replyHandler.locale('CMD.CLEAR.RESPONSE.QUEUE_EMPTY', { type: 'error', components: [], force: 'update' });
		player.queue.clear();
		if (features.web.enabled) io.to(`guild:${interaction.guildId}`).emit('queueUpdate', []);
		return interaction.replyHandler.locale('CMD.CLEAR.RESPONSE.SUCCESS', { type: 'success', components: [], force: 'update' });
	},
};
