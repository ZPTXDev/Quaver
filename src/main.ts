import '@lavaclient/queue/register';
import { Client, GatewayIntentBits, Collection, EmbedBuilder, GatewayDispatchEvents, AttachmentBuilder, SlashCommandBuilder, PermissionsBitField, ChatInputCommandInteraction, AutocompleteInteraction, ButtonInteraction, SelectMenuInteraction } from 'discord.js';
import { Node, Player } from 'lavaclient';
import { Server, Socket } from 'socket.io';
import { load } from '@lavaclient/spotify';
import { readdirSync, readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import { createInterface } from 'readline';
import { settings } from '#src/lib/util/settings.js';
import { msToTime, msToTimeString, getGuildLocaleString, getAbsoluteFileURL, TimeObject } from '#src/lib/util/util.js';
import { logger, data, setLocales } from '#src/lib/util/common.js';
import { createServer } from 'https';
import PlayerHandler from '#src/lib/PlayerHandler.js';

export const startup = { started: false };

const rl = createInterface({
	input: process.stdin,
	output: process.stdout,
});
rl.on('line', async (input): Promise<void> => {
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
			if (!settings.features.stay.whitelist) {
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
rl.on('close', async (): Promise<void> => shuttingDown('SIGINT'));

let httpServer;
if (settings.features.web.https) {
	httpServer = createServer({
		key: readFileSync(getAbsoluteFileURL(import.meta.url, ['..', ...settings.features.web.https.key.split('/')])),
		cert: readFileSync(getAbsoluteFileURL(import.meta.url, ['..', ...settings.features.web.https.cert.split('/')])),
	});
}
export const io = settings.features.web.enabled ? new Server(httpServer ?? settings.features.web.port, { cors: { origin: settings.features.web.allowedOrigins } }) : undefined;
if (io) {
	io.on('connection', async (socket): Promise<void> => {
		const webEventFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['events', 'web'])).filter((file): boolean => file.endsWith('.js') || file.endsWith('.ts'));
		for await (const file of webEventFiles) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const event: { default: { name: string, once: boolean, execute(socket: Socket, callback: () => void, ...args: any[]): void | Promise<void> } } = await import(getAbsoluteFileURL(import.meta.url, ['events', 'web', file]).toString());
			if (event.default.once) {
				socket.once(event.default.name, (args, callback): void | Promise<void> => event.default.execute(socket, callback, ...args));
			}
			else {
				socket.on(event.default.name, (args, callback): void | Promise<void> => event.default.execute(socket, callback, ...args));
			}
		}
	});
}
if (httpServer) httpServer.listen(settings.features.web.port);

load({
	client: {
		id: settings.features.spotify.client_id,
		secret: settings.features.spotify.client_secret,
	},
	autoResolveYoutubeTracks: false,
});

data.guild.instance.on('error', async (err: Error): Promise<void> => {
	logger.error({ message: 'Failed to connect to database.', label: 'Keyv' });
	await shuttingDown('keyv', err);
});

export const bot: Client & { music?: Node, commands?: Collection<unknown, unknown>, autocomplete?: Collection<unknown, unknown> } = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
bot.commands = new Collection();
bot.autocomplete = new Collection();
bot.music = new Node({
	connection: {
		host: settings.lavalink.host,
		port: settings.lavalink.port,
		password: settings.lavalink.password,
		secure: !!settings.lavalink.secure,
		reconnect: {
			delay: settings.lavalink.reconnect.delay ?? 3000,
			tries: settings.lavalink.reconnect.tries ?? 5,
		},
	},
	sendGatewayPayload: (id, payload): void => bot.guilds.cache.get(id)?.shard?.send(payload),
});
bot.ws.on(GatewayDispatchEvents.VoiceServerUpdate, async (payload): Promise<void> => bot.music.handleVoiceUpdate(payload));
bot.ws.on(GatewayDispatchEvents.VoiceStateUpdate, async (payload): Promise<void> => bot.music.handleVoiceUpdate(payload));

let inProgress = false;
/**
 * Shuts the bot down gracefully.
 * @param eventType - The event type triggering the shutdown. This determines if the shutdown was caused by a crash.
 * @param err - The error object, if any.
 */
export async function shuttingDown(eventType: string, err?: Error): Promise<void> {
	if (inProgress) return;
	inProgress = true;
	logger.info({ message: `Shutting down${eventType ? ` due to ${eventType}` : ''}...`, label: 'Quaver' });
	try {
		if (startup.started) {
			const players = bot.music.players;
			if (players.size < 1) return;
			logger.info({ message: 'Disconnecting from all guilds...', label: 'Quaver' });
			for (const pair of players) {
				const player: Player<Node> & { handler?: PlayerHandler } = pair[1];
				/** @type {string} */
				logger.info({ message: `[G ${player.guildId}] Disconnecting (restarting)`, label: 'Quaver' });
				const fileBuffer = [];
				if (player.queue.current && (player.playing || player.paused)) {
					fileBuffer.push(`${await getGuildLocaleString(player.guildId, 'MISC.CURRENT')}:`);
					fileBuffer.push(player.queue.current.uri);
				}
				if (player.queue.tracks.length > 0) {
					fileBuffer.push(`${await getGuildLocaleString(player.guildId, 'MISC.QUEUE')}:`);
					fileBuffer.push(player.queue.tracks.map((track): string => track.uri).join('\n'));
				}
				await player.handler.disconnect();
				const success = await player.handler.send(
					new EmbedBuilder()
						.setDescription(`${await getGuildLocaleString(player.guildId, ['exit', 'SIGINT', 'SIGTERM', 'lavalink'].includes(eventType) ? 'MUSIC.PLAYER.RESTARTING.DEFAULT' : 'MUSIC.PLAYER.RESTARTING.CRASHED')}${fileBuffer.length > 0 ? `\n${await getGuildLocaleString(player.guildId, 'MUSIC.PLAYER.RESTARTING.QUEUE_DATA_ATTACHED')}` : ''}`)
						.setFooter({ text: await getGuildLocaleString(player.guildId, 'MUSIC.PLAYER.RESTARTING.APOLOGY') }),
					{
						type: 'warning',
						files: fileBuffer.length > 0 ? [
							new AttachmentBuilder(Buffer.from(fileBuffer.join('\n')), { name: 'queue.txt' }),
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
		if (!['exit', 'SIGINT', 'SIGTERM'].includes(eventType) && err instanceof Error) {
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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const localeProps: Record<string, any> = {};
	for await (const file of localeFiles) {
		const categoryProps = await import(getAbsoluteFileURL(import.meta.url, ['..', 'locales', folder, file]).toString());
		const categoryName = file.split('.')[0].toUpperCase();
		localeProps[categoryName] = categoryProps.default;
	}
	locales.set(folder, localeProps);
}
setLocales(locales);

const commandFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['commands'])).filter((file): boolean => file.endsWith('.js') || file.endsWith('.ts'));
for await (const file of commandFiles) {
	const command: { default: { data: SlashCommandBuilder, checks: string[], permissions: { user: PermissionsBitField[], bot: PermissionsBitField[], execute(interaction: ChatInputCommandInteraction): Promise<void> } } } = await import(getAbsoluteFileURL(import.meta.url, ['commands', file]).toString());
	bot.commands.set(command.default.data.name, command.default);
}

const autocompleteFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['autocomplete'])).filter((file): boolean => file.endsWith('.js') || file.endsWith('.ts'));
for await (const file of autocompleteFiles) {
	const autocomplete: { default: { name: string, execute(interaction: AutocompleteInteraction): Promise<void> } } = await import(getAbsoluteFileURL(import.meta.url, ['autocomplete', file]).toString());
	bot.autocomplete.set(autocomplete.default.name, autocomplete.default);
}

const componentsFolders = readdirSync(getAbsoluteFileURL(import.meta.url, ['components']));
for await (const folder of componentsFolders) {
	const componentFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['components', folder])).filter((file): boolean => file.endsWith('.js') || file.endsWith('.ts'));
	for await (const file of componentFiles) {
		const component: { default: { name: string, execute(interaction: ButtonInteraction | SelectMenuInteraction): Promise<void> } } = await import(getAbsoluteFileURL(import.meta.url, ['components', folder, file]).toString());
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (!(bot as Record<string, any>)[folder]) (bot as Record<string, any>)[folder] = new Collection();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(bot as Record<string, any>)[folder].set(component.default.name, component.default);
	}
}

const eventFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['events'])).filter((file): boolean => file.endsWith('.js') || file.endsWith('.ts'));
for await (const file of eventFiles) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const event: { default: { name: string; once: boolean; execute(...args: any[]): void | Promise<void>; } } = await import(getAbsoluteFileURL(import.meta.url, ['events', file]).toString());
	if (event.default.once) {
		bot.once(event.default.name, (...args): void | Promise<void> => event.default.execute(...args));
	}
	else {
		bot.on(event.default.name, (...args): void | Promise<void> => event.default.execute(...args));
	}
}

const musicEventFiles = readdirSync(getAbsoluteFileURL(import.meta.url, ['events', 'music'])).filter((file): boolean => file.endsWith('.js') || file.endsWith('.ts'));
for await (const file of musicEventFiles) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const event: { default: { name: any, once: boolean, execute(...args: any[]): void & Promise<void> } } = await import(getAbsoluteFileURL(import.meta.url, ['events', 'music', file]).toString());
	if (event.default.once) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		bot.music.once(event.default.name, (...args: any[]): void => event.default.execute(...args));
	}
	else {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		bot.music.on(event.default.name, (...args: any[]): void => event.default.execute(...args));
	}
}

if (settings.features.web.enabled) setInterval((): boolean => bot.emit('timer'), 500);

bot.login(settings.token);

['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM', 'uncaughtException', 'unhandledRejection'].forEach((eventType): void => {
	process.on(eventType, async (err): Promise<void> => shuttingDown(eventType, err));
});
