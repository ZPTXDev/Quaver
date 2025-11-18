import { load as effectsLoad } from '@lavaclient/plugin-effects';
import { load as queueLoad } from '@lavaclient/plugin-queue';
import { getAbsoluteFileURL, msToTime, msToTimeString, parseTimeString } from '@zptxdev/zptx-lib';
import {
    AttachmentBuilder,
    Collection,
    ContainerBuilder,
    FileBuilder,
    GatewayIntentBits,
    SeparatorBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import { default as express, type Express } from 'express';
import type { ClientEvents } from 'lavaclient';
import { readdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import * as http from 'node:http';
import * as https from 'node:https';
import { inspect } from 'node:util';
import { createInterface } from 'node:readline';
import { Server, type Socket } from 'socket.io';
import yoctoSpinner from 'yocto-spinner';
import colors from 'yoctocolors';
import {
    type InteractionHandlerMapsFlat,
    QuaverClient,
    QuaverGuild,
    type QuaverPlayer,
    type WhitelistedFeatures,
} from './lib';
import type { QuaverMusicEvent } from './main.d';
import { data, logger, MessageOptionsBuilderType, setLocales } from './lib/util/common';
import { settings } from './lib/util/settings';
import { updateAcceptableSources, updateQueryOverrides, updateSourceManagers } from './lib/util/util';
import { version } from './lib/util/version';

export const startup = { started: false, startTime: Date.now() };
logger.info({
    message: `Starting ${colors.magenta(`Quaver ${version}`)}...`,
    label: 'Quaver',
});

const spinner = yoctoSpinner();

spinner.start(`Loading ${colors.cyan('lavaclient plugins')}`);
effectsLoad();
queueLoad();
spinner.success();

let app: Express, server;
if (settings.features.web.enabled) {
    logger.info({
        message: `Web integration is ${colors.green('enabled')}. For more information, visit ${colors.underline(colors.cyan('https://github.com/ZPTXDev/Quaver-Web'))}.`,
        label: 'Quaver',
    });
    spinner.start(`Starting ${colors.cyan('web server')}`);
    app = express();
    if (settings.grafanaLogging) {
        logger.info({
            message: `Grafana logging is ${colors.green('enabled')}. Statistics will be accessible through the /stats endpoint.`,
            label: 'Quaver',
        });
        app.get('/stats', async (req, res): Promise<void> => {
            const totalSessions = client.music?.players?.cache.size;
            const activeSessions = Array.from(
                client.music?.players?.cache.values(),
            ).filter(
                (player: QuaverPlayer): boolean =>
                    !player.timeout.standard && !player.timeout.pause,
            ).length;
            const totalQueued = Array.from(
                client.music?.players?.cache.values(),
            ).reduce(
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
                    guilds: client.guilds.cache.size,
                    users: client.users.cache.size,
                },
                memory: process.memoryUsage(),
            });
        });
    }
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
    spinner.success();
}

if (settings.features.web.enabled) {
    spinner.start(`Setting up ${colors.cyan('websocket server')}`);
}
const io = settings.features.web.enabled
    ? new Server(server, {
          cors: { origin: settings.features.web.allowedOrigins },
      })
    : undefined;
if (io) {
    spinner.success();
    spinner.start(`Loading ${colors.cyan('websocket events')}`);
    io.on('connection', async (socket): Promise<void> => {
        const webEventFiles = readdirSync(
            getAbsoluteFileURL(import.meta.url, ['events', 'web']),
        ).filter((file): boolean => file.endsWith('.mjs'));
        for await (const file of webEventFiles) {
            const event: {
                default: {
                    name: string;
                    once: boolean;
                    execute(
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
    spinner.success();
}

data.guild.instance.on('error', async (err: Error): Promise<void> => {
    logger.error({ message: 'Failed to connect to database.', label: 'Keyv' });
    await shuttingDown('keyv', err);
});

spinner.start(`Setting up ${colors.cyan('Discord client')}`);
export const client = new QuaverClient(io, {
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
    ],
});
spinner.success();

spinner.start(`Connecting to ${colors.cyan('Lavalink server')}`);
client.connectToMusicNode();
spinner.success();

spinner.start(`Verifying ${colors.cyan('Lavalink plugins and sources')}`);
const requiredPlugins = [
    'lavasrc-plugin',
    // bundled in lavasrc
    'lavalyrics-plugin',
    'youtube-plugin',
    'java-lyrics-plugin',
];
const info = await client.music.api.info();
if (
    info.plugins.length === 0 ||
    !info.plugins
        .map((plugin): string => plugin.name)
        .every((plugin): boolean => requiredPlugins.includes(plugin))
) {
    logger.warn({
        message: 'Required plugins are not loaded. Some features may not work.',
        label: 'Lavalink',
    });
}
updateQueryOverrides(info.sourceManagers);
spinner.success();

spinner.start(`Configuring ${colors.cyan('Lavalink sources')}`);
const acceptableSources = {
    youtubemusic: 'ytmsearch:',
    youtube: 'ytsearch:',
    deezer: 'dzsearch:',
    soundcloud: 'scsearch:',
    yandexmusic: 'ymsearch:',
    vkmusic: 'vksearch:',
    tidal: 'tdsearch:',
};
if (
    info.sourceManagers.length === 0 ||
    !info.sourceManagers.some((source): boolean =>
        Object.keys(acceptableSources).includes(source),
    )
) {
    logger.warn({
        message:
            'No acceptable sources were found. It is HIGHLY unlikely that this instance will work as intended.',
        label: 'Lavalink',
    });
}
const sm = [...info.sourceManagers];
if (info.sourceManagers.includes('youtube')) sm.push('youtubemusic');
for (const source of Object.keys(acceptableSources)) {
    if (sm.includes(source)) continue;
    // @ts-expect-error - expected behaviour with check above
    delete acceptableSources[source];
}
updateSourceManagers(info.sourceManagers);
updateAcceptableSources(acceptableSources);
spinner.success();

const rl = createInterface({ input: process.stdin, output: process.stdout });
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
                `There are currently ${client.music.players.cache.size} active session(s).`,
            );
            break;
        case 'stats': {
            const uptime = msToTime(client.uptime);
            const uptimeString = msToTimeString(uptime);
            console.log(
                `Statistics:\nGuilds: ${client.guilds.cache.size}\nUptime: ${uptimeString}`,
            );
            break;
        }
        case 'whitelist': {
            const guildId = input.split(' ')[1];
            const feature = input.split(' ')[2];
            const duration = input.split(' ')[3];
            let durationMs = -1;
            if (!guildId || !feature) {
                console.log('Usage: whitelist <guildId> <feature> [duration]');
                break;
            }
            const discordGuild = await client.guilds.fetch(guildId);
            const guild = await QuaverGuild.wrap(discordGuild);
            if (!guild) {
                console.log('Guild not found.');
                break;
            }
            if (!['stay', 'autolyrics', 'smartqueue'].includes(feature)) {
                console.log('Available features: stay, autolyrics, smartqueue');
                break;
            }
            let featureName = '';
            switch (feature) {
                case 'stay':
                    featureName = '24/7';
                    break;
                case 'autolyrics':
                    featureName = 'Auto Lyrics';
                    break;
                case 'smartqueue':
                    featureName = 'Smart Queue';
            }
            if (!settings.features[feature as WhitelistedFeatures].whitelist) {
                console.log(`The ${featureName} whitelist is not enabled.`);
                break;
            }
            if (duration) {
                if (!parseTimeString(duration)) {
                    console.log('Duration example: 5d1h, 1h30m, 10s');
                    break;
                }
                durationMs = parseTimeString(duration);
            }
            const whitelisted = await guild.features.checkWhitelisted(
                feature as WhitelistedFeatures,
            );
            if (whitelisted && !duration) {
                await guild.features.unset(`${feature}.whitelisted`);
                console.log(
                    `Removed ${guild.name} from the ${featureName} whitelist.`,
                );
                break;
            }
            await guild.features.set(
                `${feature}.whitelisted`,
                durationMs === -1 ? durationMs : Date.now() + durationMs,
            );
            console.log(
                `Added ${guild.name} to the ${featureName} whitelist ${
                    durationMs === -1
                        ? 'permanently'
                        : `for ${msToTimeString(msToTime(durationMs))}`
                }.`,
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

let inProgress = false;

/**
 * Shuts the client down gracefully.
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
            const players = client.music.players;
            if (players.cache.size < 1) return;
            logger.info({
                message: 'Disconnecting from all guilds...',
                label: 'Quaver',
            });
            for (const pair of players.cache) {
                const player = pair[1];
                const guild = await QuaverGuild.wrap(player.guild);
                logger.info({
                    message: `[G ${guild.id}] Disconnecting (restarting)`,
                    label: 'Quaver',
                });
                const fileBuffer = [];
                if (player.queue.current && (player.playing || player.paused)) {
                    fileBuffer.push(`${guild.locale('MISC.CURRENT')}:`);
                    fileBuffer.push(player.queue.current.info.uri);
                }
                if (player.queue.tracks.length > 0) {
                    fileBuffer.push(`${guild.locale('MISC.QUEUE')}:`);
                    fileBuffer.push(
                        player.queue.tracks
                            .map((track): string => track.info.uri)
                            .join('\n'),
                    );
                }
                await player.disconnect();
                await player.sendMessage(
                    new ContainerBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${guild.locale(
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
                                        ? `\n${guild.locale(
                                              'MUSIC.PLAYER.RESTARTING.QUEUE_DATA_ATTACHED',
                                          )}`
                                        : ''
                                }`,
                            ),
                            guild.builders.textDisplayLocale(
                                'MUSIC.PLAYER.RESTARTING.APOLOGY',
                            ),
                        )
                        .addSeparatorComponents(
                            ...(fileBuffer.length > 0
                                ? [new SeparatorBuilder()]
                                : []),
                        )
                        .addFileComponents(
                            ...(fileBuffer.length > 0
                                ? [
                                      new FileBuilder().setURL(
                                          'attachment://queue.txt',
                                      ),
                                  ]
                                : []),
                        ),
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
        await client.destroy();
        process.exit();
    }
}

spinner.start(`Loading ${colors.cyan('locales')}`);
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
spinner.success();

spinner.start(`Loading ${colors.cyan('command handlers')}`);
await client.loadHandlers(
    import.meta.url,
    ['commands', 'chatInputCommands'],
    'chatInputCommands',
);
spinner.success();

spinner.start(`Loading ${colors.cyan('autocomplete handlers')}`);
await client.loadHandlers(import.meta.url, ['autocompletes'], 'autocompletes');
spinner.success();

spinner.start(`Loading ${colors.cyan('component handlers')}`);
const componentsFolders = readdirSync(
    getAbsoluteFileURL(import.meta.url, ['components']),
);
for await (const folder of componentsFolders) {
    await client.loadHandlers(
        import.meta.url,
        ['components', folder],
        folder as keyof InteractionHandlerMapsFlat,
    );
}
spinner.success();

spinner.start(`Loading ${colors.cyan('event handlers')}`);
await client.loadEvents(import.meta.url, ['events']);
spinner.success();

spinner.start(`Loading ${colors.cyan('lavaclient event handlers')}`);
const musicEventFiles = readdirSync(
    getAbsoluteFileURL(import.meta.url, ['events', 'music']),
).filter((file): boolean => file.endsWith('.mjs'));
for await (const file of musicEventFiles) {
    const event: { default: QuaverMusicEvent } = await import(
        getAbsoluteFileURL(import.meta.url, [
            'events',
            'music',
            file,
        ]).toString()
    );
    if (event.default.once) {
        client.music.once(
            event.default.name as keyof ClientEvents,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (...args: any[]): void | Promise<void> =>
                event.default.execute(...args),
        );
    } else {
        client.music.on(
            event.default.name as keyof ClientEvents,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (...args: any[]): void | Promise<void> =>
                event.default.execute(...args),
        );
    }
}
spinner.success();

if (settings.features.web.enabled) {
    setInterval((): boolean => client.emit('timer'), 500);
}

spinner.start(`Logging in to ${colors.cyan('Discord')}`);
await client.login(settings.token);
spinner.success();

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
