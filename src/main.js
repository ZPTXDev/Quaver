import '@lavaclient/queue/register';
import { Client, GatewayIntentBits, Collection, EmbedBuilder } from 'discord.js';
import { Node } from 'lavaclient';
import { Server } from 'socket.io';
import { load } from '@lavaclient/spotify';
import { readdirSync, readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import { createInterface } from 'readline';
import { features, lavalink, token } from '#settings';
import { msToTime, msToTimeString, getGuildLocaleString, getAbsoluteFileURL } from '#lib/util/util.js';
import { logger, data, setLocales } from '#lib/util/common.js';
import { createServer } from 'https';

export const startup = { started: false };

const rl = createInterface({
	input: process.stdin,
	output: process.stdout,
});
rl.on('line', async input => {
	switch (input.split(' ')[0].toLowerCase()) {
		case 'exit':
			await shuttingDown('exit');
			break;
		case 'sessions':
			if (!startup.started) {
				console.log('Quaver is not initialized yet.');
				break;
			}
			console.log(`There are currently ${bot.music.players.size} active session(s).`);
			break;
		case 'stats': {
			const uptime = msToTime(bot.uptime);
			const uptimeString = msToTimeString(uptime);
			console.log(`Statistics:\nGuilds: ${bot.guilds.cache.size}\nUptime: ${uptimeString}`);
			break;
		}
		case 'whitelist': {
			if (!startup.started) {
				console.log('Quaver is not initialized yet.');
				break;
			}
			const guildId = input.split(' ')[1];
			if (!features.stay.whitelist) {
				console.log('The 24/7 whitelist is not enabled.');
				break;
			}
			const guild = bot.guilds.cache.get(guildId);
			if (!guild) {
				console.log('Guild not found.');
				break;
			}
			if (!await data.guild.get(guildId, 'features.stay.whitelisted')) {
				await data.guild.set(guildId, 'features.stay.whitelisted', true);
				console.log(`Added ${guild.name} to the 24/7 whitelist.`);
			}
			else {
				await data.guild.set(guildId, 'features.stay.whitelisted', false);
				console.log(`Removed ${guild.name} from the 24/7 whitelist.`);
			}
			break;
		}
		default:
			console.log('Available commands: exit, sessions, whitelist, stats');
			break;
	}
});
// 'close' event catches ctrl+c, therefore we pass it to shuttingDown as a ctrl+c event
rl.on('close', async () => shuttingDown('SIGINT'));

let httpServer;
if (features.web.https) {
	httpServer = createServer({
		key: readFileSync(getAbsoluteFileURL(import.meta.url, ['..', ...features.web.https.key.split('/')])),
		cert: readFileSync(getAbsoluteFileURL(import.meta.url, ['..', ...features.web.https.cert.split('/')])),
	});
}
export const io = features.web.enabled ? new Server(httpServer ?? features.web.port, { cors: { origin: features.web.allowedOrigins } }) : undefined;
if (io) {
	io.on('connection', async socket => {
		const webEventFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['events', 'web'])).filter(file => file.endsWith('.js'));
		for await (const file of webEventFiles) {
			/** @type {{name: string, once: boolean, execute(args, callback): void | Promise<void>}} */
			const event = await import(getAbsoluteFileURL(import.meta.url, ['events', 'web', file]));
			if (event.default.once) {
				socket.once(event.default.name, (args, callback) => event.default.execute(socket, ...args, callback));
			}
			else {
				socket.on(event.default.name, (args, callback) => event.default.execute(socket, ...args, callback));
			}
		}
	});
}
if (httpServer) httpServer.listen(features.web.port);

load({
	client: {
		id: features.spotify.client_id,
		secret: features.spotify.client_secret,
	},
	autoResolveYoutubeTracks: false,
});

/**
 * Handles database connection errors from Keyv.
 * @param {Error} err The error.
 */
data.guild.instance.on('error', async err => {
	logger.error({ message: 'Failed to connect to database.', label: 'Keyv' });
	await shuttingDown('keyv', err);
});

/** @type {Client & {commands: Collection, buttons: Collection, selects: Collection, music: Node}} */
export const bot = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
bot.commands = new Collection();
bot.autocomplete = new Collection();
bot.music = new Node({
	connection: {
		host: lavalink.host,
		port: lavalink.port,
		password: lavalink.password,
		secure: !!lavalink.secure,
		reconnect: {
			delay: lavalink.reconnect.delay ?? 3000,
			tries: lavalink.reconnect.tries ?? 5,
		},
	},
	sendGatewayPayload: (id, payload) => bot.guilds.cache.get(id)?.shard?.send(payload),
});
bot.ws.on('VOICE_SERVER_UPDATE', async payload => bot.music.handleVoiceUpdate(payload));
bot.ws.on('VOICE_STATE_UPDATE', async payload => bot.music.handleVoiceUpdate(payload));

let inProgress = false;
/**
 * Shuts the bot down gracefully.
 * @param {string} eventType The event type triggering the shutdown. This determines if the shutdown was caused by a crash.
 * @param {Error} err The error object, if any.
 */
export async function shuttingDown(eventType, err) {
	if (inProgress) return;
	inProgress = true;
	logger.info({ message: `Shutting down${eventType ? ` due to ${eventType}` : ''}...`, label: 'Quaver' });
	try {
		if (startup.started) {
			const players = bot.music.players;
			if (players.size < 1) return;
			logger.info({ message: 'Disconnecting from all guilds...', label: 'Quaver' });
			for (const pair of players) {
				/** @type {import('lavaclient').Player & {handler: import('#lib/PlayerHandler.js').default}} */
				const player = pair[1];
				/** @type {string} */
				logger.info({ message: `[G ${player.guildId}] Disconnecting (restarting)`, label: 'Quaver' });
				const fileBuffer = [];
				if (player.queue.current && (player.playing || player.paused)) {
					fileBuffer.push(`${await getGuildLocaleString(player.guildId, 'MISC.CURRENT')}:`);
					fileBuffer.push(player.queue.current.uri);
				}
				if (player.queue.tracks.length > 0) {
					fileBuffer.push(`${await getGuildLocaleString(player.guildId, 'MISC.QUEUE')}:`);
					fileBuffer.push(player.queue.tracks.map(track => track.uri).join('\n'));
				}
				await player.handler.disconnect();
				const success = await player.handler.send(
					new EmbedBuilder()
						.setDescription(`${await getGuildLocaleString(player.guildId, ['exit', 'SIGINT', 'SIGTERM', 'lavalink'].includes(eventType) ? 'MUSIC.PLAYER.RESTARTING.DEFAULT' : 'MUSIC.PLAYER.RESTARTING.CRASHED')}${fileBuffer.length > 0 ? `\n${await getGuildLocaleString(player.guildId, 'MUSIC.PLAYER.RESTARTING.QUEUE_DATA_ATTACHED')}` : ''}`)
						.setFooter({ text: await getGuildLocaleString(player.guildId, 'MUSIC.PLAYER.RESTARTING.APOLOGY') }),
					{
						type: 'warning',
						files: fileBuffer.length > 0 ? [
							{
								attachment: Buffer.from(fileBuffer.join('\n')),
								name: 'queue.txt',
							},
						] : [],
					},
				);
				if (!success) continue;
			}
		}
	}
	catch (error) {
		logger.error({ message: 'Encountered error while shutting down.', label: 'Quaver' });
		logger.error({ message: `${error.message}\n${error.stack}`, label: 'Quaver' });
	}
	finally {
		if (!['exit', 'SIGINT', 'SIGTERM'].includes(eventType)) {
			logger.error({ message: `${err.message}\n${err.stack}`, label: 'Quaver' });
			logger.info({ message: 'Logging additional output to error.log.', label: 'Quaver' });
			try {
				await writeFile('error.log', `${eventType}${err.message ? `\n${err.message}` : ''}${err.stack ? `\n${err.stack}` : ''}`);
			}
			catch (e) {
				logger.error({ message: 'Encountered error while writing to error.log.', label: 'Quaver' });
				logger.error({ message: `${e.message}\n${e.stack}`, label: 'Quaver' });
			}
		}
		bot.destroy();
		process.exit();
	}
}

const locales = new Collection();
const localeFolders = readdirSync(getAbsoluteFileURL(import.meta.url, ['..', 'locales']));
for await (const folder of localeFolders) {
	const localeFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['..', 'locales', folder]));
	const localeData = {};
	for await (const file of localeFiles) {
		const locale = await import(getAbsoluteFileURL(import.meta.url, ['..', 'locales', folder, file]));
		localeData[file.split('.')[0].toUpperCase()] = locale.default;
	}
	locales.set(folder, localeData);
}
setLocales(locales);

const commandFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['commands'])).filter(file => file.endsWith('.js'));
for await (const file of commandFiles) {
	/** @type {{data: import('@discordjs/builders').SlashCommandBuilder, checks: string[], permissions: {user: string[], bot: string[]}, execute(interaction: import('discord.js').ChatInputCommandInteraction): Promise<void>}} */
	const command = await import(getAbsoluteFileURL(import.meta.url, ['commands', file]));
	bot.commands.set(command.default.data.name, command.default);
}

const autocompleteFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['autocomplete'])).filter(file => file.endsWith('.js'));
for await (const file of autocompleteFiles) {
	/** @type {{name: string, execute(interaction: import('discord.js').ApplicationCommandAutocompleteInteraction): Promise<void>}} */
	const autocomplete = await import(getAbsoluteFileURL(import.meta.url, ['autocomplete', file]));
	bot.autocomplete.set(autocomplete.default.name, autocomplete.default);
}

const componentsFolders = readdirSync(getAbsoluteFileURL(import.meta.url, ['components']));
for await (const folder of componentsFolders) {
	const componentFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['components', folder])).filter(file => file.endsWith('.js'));
	for await (const file of componentFiles) {
		/** @type {{name: string, execute(interaction: import('discord.js').ButtonInteraction | import('discord.js').SelectMenuInteraction): Promise<void>}} */
		const component = await import(getAbsoluteFileURL(import.meta.url, ['components', folder, file]));
		if (!bot[folder]) bot[folder] = new Collection();
		bot[folder].set(component.default.name, component.default);
	}
}

const eventFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['events'])).filter(file => file.endsWith('.js'));
for await (const file of eventFiles) {
	/** @type {{name: string, once: boolean, execute(...args): void | Promise<void>}} */
	const event = await import(getAbsoluteFileURL(import.meta.url, ['events', file]));
	if (event.default.once) {
		bot.once(event.default.name, (...args) => event.default.execute(...args));
	}
	else {
		bot.on(event.default.name, (...args) => event.default.execute(...args));
	}
}

const musicEventFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['events', 'music'])).filter(file => file.endsWith('.js'));
for await (const file of musicEventFiles) {
	/** @type {{name: string, once: boolean, execute(...args): void | Promise<void>}} */
	const event = await import(getAbsoluteFileURL(import.meta.url, ['events', 'music', file]));
	if (event.default.once) {
		bot.music.once(event.default.name, (...args) => event.default.execute(...args));
	}
	else {
		bot.music.on(event.default.name, (...args) => event.default.execute(...args));
	}
}

if (features.web.enabled) setInterval(() => bot.emit('timer'), 500);

bot.login(token);

['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM', 'uncaughtException', 'unhandledRejection'].forEach(eventType => {
	process.on(eventType, async err => shuttingDown(eventType, err));
});
