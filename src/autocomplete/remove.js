export default {
	name: 'remove',
	async execute(interaction) {
		const focused = interaction.options.getFocused();
		const player = interaction.client.music.players.get(interaction.guildId);
		if (!player) return interaction.respond([]);
		return interaction.respond(
			player.queue.tracks
				.map((track, index) => ({ name: `${index + 1}. ${track.title}`, value: index + 1, title: track.title, requester: track.requester }))
				.filter(track => track.requester === interaction.user.id && track.title.toLowerCase().startsWith(focused.toLowerCase()))
				.map(track => ({ name: track.name.length >= 100 ? `${track.name.substring(0, 97)}...` : track.name, value: track.value })),
		);
	},
};
