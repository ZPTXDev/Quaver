import { confirmationTimeout } from '#lib/util/common.js';
import { checks } from '#lib/util/constants.js';

export default {
	name: 'disconnect',
	async execute(interaction) {
		if (interaction.message.interaction.user.id !== interaction.user.id) return interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player) return interaction.replyHandler.locale(checks.ACTIVE_SESSION, { type: 'error' });
		if (!interaction.member?.voice.channelId) return interaction.replyHandler.locale(checks.IN_VOICE, { type: 'error' });
		if (player && interaction.member?.voice.channelId !== player.channelId) return interaction.replyHandler.locale(checks.IN_SESSION_VOICE, { type: 'error' });
		clearTimeout(confirmationTimeout[interaction.message.id]);
		delete confirmationTimeout[interaction.message.id];
		await player.handler.disconnect();
		return interaction.replyHandler.locale('CMD.DISCONNECT.RESPONSE.SUCCESS', { type: 'success', components: [], force: 'update' });
	},
};
