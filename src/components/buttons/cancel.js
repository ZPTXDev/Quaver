import { confirmationTimeout } from '#lib/util/common.js';

export default {
	name: 'cancel',
	async execute(interaction) {
		if (interaction.message.interaction.user.id !== interaction.user.id) return interaction.replyHandler.locale('DISCORD.INTERACTION.USER_MISMATCH', { type: 'error' });
		clearTimeout(confirmationTimeout[interaction.message.id]);
		delete confirmationTimeout[interaction.message.id];
		return interaction.replyHandler.locale('DISCORD.INTERACTION.CANCELED', { args: [interaction.message.interaction.user.id], components: [], force: 'update' });
	},
};
