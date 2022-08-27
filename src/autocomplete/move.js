export default {
	name: 'move',
	async execute(interaction) {
		const focused = interaction.options.getFocused();
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player) return interaction.respond([]);
		return interaction.respond(
			player.queue.tracks
				.filter(track => track.title.toLowerCase().startsWith(focused.toLowerCase()))
				.map((track, index) => ({ name: `${index + 1}. ${track.title}`, value: index + 1 })),
		);
	},
};
