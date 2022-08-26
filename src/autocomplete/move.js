export default {
	name: 'move',
	async execute(interaction) {
		const focusedOption = interaction.options.getFocused(true);
		if (focusedOption.name !== 'old_position') return;
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player) return interaction.respond([]);
		return interaction.respond(
			player.queue.tracks
				.filter(track => track.title.toLowerCase().startsWith(focusedOption.value.toLowerCase()))
				.map((track, index) => ({ name: `${index + 1}. ${track.title}`, value: track.value })),
		);
	},
};
