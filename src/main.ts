import type {
    Autocomplete,
    Button,
    ChatInputCommand,
    ModalSubmit,
    SelectMenu,
} from '#src/events/interactionCreate.d.js';
import type { QuaverClient, QuaverPlayer } from '#src/lib/util/common.d.js';
import {
    data,
    logger,
    MessageOptionsBuilderType,
    setLocales,
} from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import {
    getAbsoluteFileURL,
    getGuildLocaleString,
    msToTime,
    msToTimeString,
} from '#src/lib/util/util.js';
import '@lavaclient/queue/register';
import { load } from '@lavaclient/spotify';
import {
    AttachmentBuilder,
    Client,
    Collection,
    EmbedBuilder,
    GatewayDispatchEvents,
    GatewayIntentBits,
} from 'discord.js';
import type { Express } from 'express';
import express from 'express';
import { readdirSync, readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import * as http from 'http';
import * as https from 'https';
import type { NodeEvents } from 'lavaclient';
import { Node } from 'lavaclient';
import { createInterface } from 'readline';
import type { Socket } from 'socket.io';
import { Server } from 'socket.io';
import { inspect } from 'util';
import { version } from './lib/util/version.js';
import type { QuaverEvent, QuaverMusicEvent } from './main.d.js';

export const startup = { started: false };

const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
});
rl.on('line', async (input): Promise<void> => {
    const command = input.split(' ')[0].toLowerCase();
    if (['sessions', 'whitelist'].includes(command) && !startup.started) {
        console.log('Quaver is not initialized yet.');
        return;
    }
    switch (command) {
        case 'exit':
            await shuttingDown('exit');
            break;
        case 'sessions':
            console.log(
                `There are currently ${bot.music.players.size} active session(s).`,
            );
            break;
        case 'stats': {
            const uptime = msToTime(bot.uptime);
            const uptimeString = msToTimeString(uptime);
            console.log(
                `Statistics:\nGuilds: ${bot.guilds.cache.size}\nUptime: ${uptimeString}`,
            );
            break;
        }
        case 'whitelist': {
            const guildId = input.split(' ')[1];
            const feature = input.split(' ')[2];
            if (!guildId || !feature) {
                console.log('Usage: whitelist <guildId> <feature>');
                break;
            }
            const guild = await bot.guilds.fetch(guildId);
            if (!guild) {
                console.log('Guild not found.');
                break;
            }
            if (!['stay', 'autolyrics'].includes(feature)) {
                console.log('Available features: stay, autolyrics');
                break;
            }
            let featureName = '';
            switch (feature) {
                case 'stay':
                    featureName = '24/7';
                    break;
                case 'autolyrics':
                    featureName = 'Auto Lyrics';
            }
            if (
                !settings.features[feature as 'stay' | 'autolyrics'].whitelist
            ) {
                console.log(`The ${featureName} whitelist is not enabled.`);
                break;
            }
            const whitelisted = !(await data.guild.get<boolean>(
                guildId,
                `features.${feature}.whitelisted`,
            ));
            await data.guild.set(
                guildId,
                `features.${feature}.whitelisted`,
                whitelisted,
            );
            console.log(
                `${whitelisted ? 'Added' : 'Removed'} ${guild.name} ${
                    whitelisted ? 'to' : 'from'
                } the ${featureName} whitelist.`,
            );
            break;
        }
        case 'eval': {
            if (!settings.developerMode) {
                console.log('Developer mode is not enabled.');
                break;
            }
            if (!input.substring(command.length + 1)) {
                console.log('No input provided.');
                break;
            }
            let output: string;
            try {
                output = await eval(input.substring(command.length + 1));
                if (typeof output !== 'string') {
                    output = inspect(output, { depth: 1 });
                }
            } catch (error) {
                output = error;
            }
            if (!output) output = '[no output]';
            console.log(output);
            break;
        }
        default:
            console.log('Available commands: exit, sessions, whitelist, stats');
            break;
    }
});
// 'close' event catches ctrl+c, therefore we pass it to shuttingDown as a ctrl+c event
rl.on('close', async (): Promise<void> => shuttingDown('SIGINT'));

let app: Express, server;
if (settings.features.web.enabled) {
    app = express();
    app.get('/stats', async (req, res): Promise<void> => {
        const totalSessions = bot.music?.players?.size;
        const activeSessions = Array.from(bot.music?.players?.values()).filter(
            (player: QuaverPlayer): boolean =>
                !player.timeout && !player.pauseTimeout,
        ).length;
        const totalQueued = Array.from(bot.music?.players?.values()).reduce(
            (total: number, player: QuaverPlayer): number =>
                total + player.queue?.tracks.length,
            0,
        );
        res.send({
            sessions: {
                total: totalSessions,
                active: activeSessions,
                idle: totalSessions - activeSessions,
            },
            tracks: {
                totalQueued: totalQueued,
            },
            versions: {
                node: process.version,
                quaver: version,
            },
            cache: {
                guilds: bot.guilds.cache.size,
                users: bot.users.cache.size,
            },
            memory: process.memoryUsage(),
        });
    });
    if (settings.features.web.https.enabled) {
        server = https.createServer(
            {
                key: readFileSync(
                    getAbsoluteFileURL(import.meta.url, [
                        '..',
                        ...settings.features.web.https.key.split('/'),
                    ]),
                ),
                cert: readFileSync(
                    getAbsoluteFileURL(import.meta.url, [
                        '..',
                        ...settings.features.web.https.cert.split('/'),
                    ]),
                ),
            },
            app,
        );
    } else {
        server = http.createServer(app);
    }
    server.listen(settings.features.web.port);
}
export const io = settings.features.web.enabled
    ? new Server(server, {
          cors: { origin: settings.features.web.allowedOrigins },
      })
    : undefined;
if (io) {
    io.on('connection', async (socket): Promise<void> => {
        const webEventFiles = readdirSync(
            getAbsoluteFileURL(import.meta.url, ['events', 'web']),
        ).filter(
            (file): boolean => file.endsWith('.js') || file.endsWith('.ts'),
        );
        for await (const file of webEventFiles) {
            const event: {
                default: {
                    name: string;
                    once: boolean;
                    execute(
                        // eslint-disable-next-line @typescript-eslint/no-shadow
                        socket: Socket,
                        callback: () => void,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ...args: any[]
                    ): void | Promise<void>;
                };
            } = await import(
                getAbsoluteFileURL(import.meta.url, [
                    'events',
                    'web',
                    file,
                ]).toString()
            );
            if (event.default.once) {
                socket.once(
                    event.default.name,
                    (args, callback): void | Promise<void> =>
                        event.default.execute(socket, callback, ...args),
                );
            } else {
                socket.on(
                    event.default.name,
                    (args, callback): void | Promise<void> =>
                        event.default.execute(socket, callback, ...args),
                );
            }
        }
    });
}

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

export const bot: QuaverClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
    ],
});
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
    sendGatewayPayload: (id, payload): void =>
        bot.guilds.cache.get(id)?.shard?.send(payload),
});
bot.ws.on(
    GatewayDispatchEvents.VoiceServerUpdate,
    async (payload): Promise<void> => bot.music.handleVoiceUpdate(payload),
);
bot.ws.on(
    GatewayDispatchEvents.VoiceStateUpdate,
    async (payload): Promise<void> => bot.music.handleVoiceUpdate(payload),
);

let inProgress = false;
/**
 * Shuts the bot down gracefully.
 * @param eventType - The event type triggering the shutdown. This determines if the shutdown was caused by a crash.
 * @param err - The error object, if any.
 */
export async function shuttingDown(
    eventType: string,
    err?: Error,
): Promise<void> {
    if (inProgress) return;
    inProgress = true;
    logger.info({
        message: `Shutting down${eventType ? ` due to ${eventType}` : ''}...`,
        label: 'Quaver',
    });
    try {
        if (startup.started) {
            const players = bot.music.players;
            if (players.size < 1) return;
            logger.info({
                message: 'Disconnecting from all guilds...',
                label: 'Quaver',
            });
            for (const pair of players) {
                const player: QuaverPlayer = pair[1];
                logger.info({
                    message: `[G ${player.guildId}] Disconnecting (restarting)`,
                    label: 'Quaver',
                });
                const fileBuffer = [];
                if (player.queue.current && (player.playing || player.paused)) {
                    fileBuffer.push(
                        `${await getGuildLocaleString(
                            player.guildId,
                            'MISC.CURRENT',
                        )}:`,
                    );
                    fileBuffer.push(player.queue.current.uri);
                }
                if (player.queue.tracks.length > 0) {
                    fileBuffer.push(
                        `${await getGuildLocaleString(
                            player.guildId,
                            'MISC.QUEUE',
                        )}:`,
                    );
                    fileBuffer.push(
                        player.queue.tracks
                            .map((track): string => track.uri)
                            .join('\n'),
                    );
                }
                await player.handler.disconnect();
                const success = await player.handler.send(
                    new EmbedBuilder()
                        .setDescription(
                            `${await getGuildLocaleString(
                                player.guildId,
                                [
                                    'exit',
                                    'SIGINT',
                                    'SIGTERM',
                                    'lavalink',
                                ].includes(eventType)
                                    ? 'MUSIC.PLAYER.RESTARTING.DEFAULT'
                                    : 'MUSIC.PLAYER.RESTARTING.CRASHED',
                            )}${
                                fileBuffer.length > 0
                                    ? `\n${await getGuildLocaleString(
                                          player.guildId,
                                          'MUSIC.PLAYER.RESTARTING.QUEUE_DATA_ATTACHED',
                                      )}`
                                    : ''
                            }`,
                        )
                        .setFooter({
                            text: await getGuildLocaleString(
                                player.guildId,
                                'MUSIC.PLAYER.RESTARTING.APOLOGY',
                            ),
                        }),
                    {
                        type: MessageOptionsBuilderType.Warning,
                        files:
                            fileBuffer.length > 0
                                ? [
                                      new AttachmentBuilder(
                                          Buffer.from(fileBuffer.join('\n')),
                                          { name: 'queue.txt' },
                                      ),
                                  ]
                                : [],
                    },
                );
                if (!success) continue;
            }
        }
    } catch (error) {
        if (error instanceof Error) {
            logger.error({
                message: 'Encountered error while shutting down.',
                label: 'Quaver',
            });
            logger.error({
                message: `${error.message}\n${error.stack}`,
                label: 'Quaver',
            });
        }
    } finally {
        if (
            !['exit', 'SIGINT', 'SIGTERM'].includes(eventType) &&
            err instanceof Error
        ) {
            logger.error({
                message: `${err.message}\n${err.stack}`,
                label: 'Quaver',
            });
            logger.info({
                message: 'Logging additional output to error.log.',
                label: 'Quaver',
            });
            try {
                await writeFile(
                    'error.log',
                    `${eventType}${err.message ? `\n${err.message}` : ''}${
                        err.stack ? `\n${err.stack}` : ''
                    }`,
                );
            } catch (e) {
                if (e instanceof Error) {
                    logger.error({
                        message:
                            'Encountered error while writing to error.log.',
                        label: 'Quaver',
                    });
                    logger.error({
                        message: `${e.message}\n${e.stack}`,
                        label: 'Quaver',
                    });
                }
            }
        }
        bot.destroy();
        process.exit();
    }
}

const locales = new Collection<string, unknown>();
const localeFolders = readdirSync(
    getAbsoluteFileURL(import.meta.url, ['..', 'locales']),
);
for await (const folder of localeFolders) {
    const localeFiles = readdirSync(
        getAbsoluteFileURL(import.meta.url, ['..', 'locales', folder]),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const localeProps: Record<string, any> = {};
    for await (const file of localeFiles) {
        const categoryProps = await import(
            getAbsoluteFileURL(import.meta.url, [
                '..',
                'locales',
                folder,
                file,
            ]).toString()
        );
        const categoryName = file.split('.')[0].toUpperCase();
        localeProps[categoryName] = categoryProps.default;
    }
    locales.set(folder, localeProps);
}
setLocales(locales);

const commandFiles = readdirSync(
    getAbsoluteFileURL(import.meta.url, ['commands']),
).filter((file): boolean => file.endsWith('.js') || file.endsWith('.ts'));
for await (const file of commandFiles) {
    const command: { default: ChatInputCommand } = await import(
        getAbsoluteFileURL(import.meta.url, ['commands', file]).toString()
    );
    bot.commands.set(command.default.data.name, command.default);
}

const autocompleteFiles = readdirSync(
    getAbsoluteFileURL(import.meta.url, ['autocomplete']),
).filter((file): boolean => file.endsWith('.js') || file.endsWith('.ts'));
for await (const file of autocompleteFiles) {
    const autocomplete: { default: Autocomplete } = await import(
        getAbsoluteFileURL(import.meta.url, ['autocomplete', file]).toString()
    );
    bot.autocomplete.set(autocomplete.default.name, autocomplete.default);
}

const componentsFolders = readdirSync(
    getAbsoluteFileURL(import.meta.url, ['components']),
);
for await (const folder of componentsFolders) {
    const componentFiles = readdirSync(
        getAbsoluteFileURL(import.meta.url, ['components', folder]),
    ).filter((file): boolean => file.endsWith('.js') || file.endsWith('.ts'));
    for await (const file of componentFiles) {
        const component: { default: Button | SelectMenu | ModalSubmit } =
            await import(
                getAbsoluteFileURL(import.meta.url, [
                    'components',
                    folder,
                    file,
                ]).toString()
            );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(bot as Record<string, any>)[folder]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (bot as Record<string, any>)[folder] = new Collection();
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (bot as Record<string, any>)[folder].set(
            component.default.name,
            component.default,
        );
    }
}

const eventFiles = readdirSync(
    getAbsoluteFileURL(import.meta.url, ['events']),
).filter((file): boolean => file.endsWith('.js') || file.endsWith('.ts'));
for await (const file of eventFiles) {
    const event: { default: QuaverEvent } = await import(
        getAbsoluteFileURL(import.meta.url, ['events', file]).toString()
    );
    if (event.default.once) {
        bot.once(event.default.name, (...args): void | Promise<void> =>
            event.default.execute(...args),
        );
    } else {
        bot.on(event.default.name, (...args): void | Promise<void> =>
            event.default.execute(...args),
        );
    }
}

const musicEventFiles = readdirSync(
    getAbsoluteFileURL(import.meta.url, ['events', 'music']),
).filter((file): boolean => file.endsWith('.js') || file.endsWith('.ts'));
for await (const file of musicEventFiles) {
    const event: { default: QuaverMusicEvent } = await import(
        getAbsoluteFileURL(import.meta.url, [
            'events',
            'music',
            file,
        ]).toString()
    );
    if (event.default.once) {
        bot.music.once(
            event.default.name as keyof NodeEvents,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (...args: any[]): void | Promise<void> =>
                event.default.execute(...args),
        );
    } else {
        bot.music.on(
            event.default.name as keyof NodeEvents,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (...args: any[]): void | Promise<void> =>
                event.default.execute(...args),
        );
    }
}

if (settings.features.web.enabled) {
    setInterval((): boolean => bot.emit('timer'), 500);
}

bot.login(settings.token);

[
    'exit',
    'SIGINT',
    'SIGUSR1',
    'SIGUSR2',
    'SIGTERM',
    'uncaughtException',
    'unhandledRejection',
].forEach((eventType): void => {
    process.on(
        eventType,
        async (err): Promise<void> => shuttingDown(eventType, err),
    );
});
