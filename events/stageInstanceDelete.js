module.exports = {
	name: 'stageInstanceDelete',
	once: false,
	/** @param {import('discord.js').StageInstance & {client: import('discord.js').Client & {music: import('lavaclient').Node}}} stageInstance */
	async execute(stageInstance) {
		const player = stageInstance.client.music.players.get(stageInstance.guildId);
		if (player?.channelId !== stageInstance.channelId) return;
		player.stageEnded = true;
	},
};
