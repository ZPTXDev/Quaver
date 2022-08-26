export default {
	name: 'update',
	once: false,
	async execute(socket, guildId, item, callback) {
		const { bot, io } = await import('#src/main.js');
		if (!socket.guilds) return callback({ status: 'error-auth' });
		if (!socket.guilds.find(guild => guild.id === guildId)) return callback({ status: 'error-auth' });
		if (bot.guilds.cache.get(guildId)?.members.cache.get(socket.user.id)?.voice.channelId !== bot.guilds.cache.get(guildId).members.me.voice.channelId) return callback({ status: 'error-generic' });
		switch (item.type) {
			case 'loop': {
				const player = bot.music.players.get(guildId);
				if (!player) return callback({ status: 'error-generic' });
				player.queue.setLoop(item.value);
				io.to(`guild:${guildId}`).emit('loopUpdate', item.value);
				break;
			}
			case 'volume': {
				const player = bot.music.players.get(guildId);
				if (!player) return callback({ status: 'error-generic' });
				player.setVolume(item.value);
				io.to(`guild:${guildId}`).emit('volumeUpdate', item.value);
				break;
			}
			case 'paused': {
				const player = bot.music.players.get(guildId);
				if (!player) return callback({ status: 'error-generic' });
				player.pause(item.value);
				io.to(`guild:${guildId}`).emit('pauseUpdate', item.value);
				break;
			}
			case 'skip': {
				const player = bot.music.players.get(guildId);
				if (!player) return callback({ status: 'error-generic' });
				if (player.queue.current.requester === socket.user.id) {
					await player.queue.skip();
					await player.queue.start();
					break;
				}
				const skip = player.skip ?? { required: Math.ceil(bot.guilds.cache.get(guildId).members.me.voice.channel.members.filter(m => !m.user.bot).size / 2), users: [] };
				if (skip.users.includes(socket.user.id)) return { status: 'error-generic' };
				skip.users.push(socket.user.id);
				if (skip.users.length >= skip.required) {
					await player.queue.skip();
					await player.queue.start();
					await player.queue.next();
					break;
				}
				player.skip = skip;
				break;
			}
			case 'bassboost': {
				const player = bot.music.players.get(guildId);
				if (!player) return callback({ status: 'error-generic' });
				let eqValues = new Array(15).fill(0);
				if (item.value) eqValues = [0.2, 0.15, 0.1, 0.05, 0.0, ...new Array(10).fill(-0.05)];
				await player.setEqualizer(eqValues);
				player.bassboost = item.value;
				io.to(`guild:${guildId}`).emit('filterUpdate', { bassboost: player.bassboost, nightcore: player.nightcore });
				break;
			}
			case 'nightcore': {
				const player = bot.music.players.get(guildId);
				if (!player) return callback({ status: 'error-generic' });
				player.filters.timescale = item.value ? { speed: 1.125, pitch: 1.125, rate: 1 } : undefined;
				await player.setFilters();
				player.nightcore = item.value;
				io.to(`guild:${guildId}`).emit('filterUpdate', { bassboost: player.bassboost, nightcore: player.nightcore });
				break;
			}
			case 'seek': {
				const player = bot.music.players.get(guildId);
				if (!player) return callback({ status: 'error-generic' });
				await player.seek(item.value);
				break;
			}
			case 'remove': {
				const player = bot.music.players.get(guildId);
				if (!player) return callback({ status: 'error-generic' });
				player.queue.remove(item.value);
				io.to(`guild:${guildId}`).emit('queueUpdate', player.queue.tracks.map(t => {
					t.requesterTag = bot.users.cache.get(t.requester)?.tag;
					return t;
				}));
				break;
			}
			case 'shuffle': {
				const player = bot.music.players.get(guildId);
				if (!player) return callback({ status: 'error-generic' });
				let currentIndex = player.queue.tracks.length, randomIndex;
				while (currentIndex !== 0) {
					randomIndex = Math.floor(Math.random() * currentIndex);
					currentIndex--;
					[player.queue.tracks[currentIndex], player.queue.tracks[randomIndex]] = [player.queue.tracks[randomIndex], player.queue.tracks[currentIndex]];
				}
				io.to(`guild:${player.guildId}`).emit('queueUpdate', player.queue.tracks.map(t => {
					t.requesterTag = bot.users.cache.get(t.requester)?.tag;
					return t;
				}));
				break;
			}
		}
		return callback({ status: 'success' });
	},
};
