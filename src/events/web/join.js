export default {
	name: 'join',
	once: false,
	async execute(socket, guildId, callback) {
		const { bot } = await import('#src/main.js');
		if (!socket.guilds) return callback({ status: 'error-auth' });
		if (!socket.guilds.find(guild => guild.id === guildId)) return callback({ status: 'error-auth' });
		if (!bot.guilds.cache.get(guildId)) return callback({ status: 'error-generic' });
		socket.join(`guild:${guildId}`);
		return callback({ status: 'success' });
	},
};
