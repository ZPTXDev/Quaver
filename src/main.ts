import { load as effectsLoad } from '@lavaclient/plugin-effects';
import { load as queueLoad } from '@lavaclient/plugin-queue';
import {
    getAbsoluteFileURL,
    msToTime,
    msToTimeString,
    parseTimeString,
} from '@zptxdev/zptx-lib';
import { createCache } from 'cache-manager';
import { KeyvCacheableMemory } from 'cacheable';
import { Collection, GatewayIntentBits } from 'discord.js';
import { default as express, type Express } from 'express';
import Keyv from 'keyv';
import type { ClientEvents, NodeEvents } from 'lavaclient';
import { readdirSync, readFileSync } from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { Server, type Socket } from 'socket.io';
import yoctoSpinner from 'yocto-spinner';
import colors from 'yoctocolors';
import { QuaverClient } from './lib';
import { data, DataHandler } from './lib/data';
import { QuaverGuild, type WhitelistedFeatures } from './lib/guild';
import type { InteractionHandlerMapsFlat } from './lib/interactions';
import { setLocales } from './lib/locales';
import { logger } from './lib/logger';
import type { QuaverPlayer } from './lib/music';
import { startup, updateHandler } from './lib/state';
import {
    loadVersion,
    settings,
    updateAcceptableSources,
    updateQueryOverrides,
    updateSourceManagers,
    version,
} from './lib/util';

type QuaverMusicEvent = {
    name: keyof NodeEvents;
    once: boolean;
    execute(...args: unknown[]): void | Promise<void>;
};

const __dirname = dirname(fileURLToPath(import.meta.url));

await loadVersion();

startup.startTime = Date.now();
logger.info(`Starting ${colors.magenta(`Quaver ${version.version}`)}...`);

const spinner = yoctoSpinner();

spinner.start(`Loading ${colors.cyan('lavaclient plugins')}`);
effectsLoad();
queueLoad();
spinner.success();

spinner.start(`Setting up ${colors.cyan('data handler')}`);
data.guild = new DataHandler({
    cache: settings.database
        ? `${settings.database.protocol}://${resolve(
              __dirname,
              '..',
              settings.database.path,
          )}`
        : `sqlite://${resolve(__dirname, '..', 'database.sqlite')}`,
    namespace: 'guild',
});
spinner.success();

spinner.start(`Setting up ${colors.cyan('cache')}`);
data.cache = createCache({
    stores: [new Keyv({ store: new KeyvCacheableMemory({ ttl: '10m' }) })],
});
spinner.success();

let app: Express, server;
if (settings.features.web.enabled) {
    logger.info(
        `Web integration is ${colors.green('enabled')}. For more information, visit ${colors.underline(colors.cyan('https://github.com/ZPTXDev/Quaver-Web'))}.`,
    );
    spinner.start(`Starting ${colors.cyan('web server')}`);
    app = express();
    if (settings.grafanaLogging) {
        logger.info(
            `Grafana logging is ${colors.green('enabled')}. Statistics will be accessible through the /stats endpoint.`,
        );
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
                    quaver: version.version,
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

spinner.start(`Setting up ${colors.cyan('Discord client')}`);
export const client = new QuaverClient(io, {
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
    ],
});
spinner.success();

data.guild.instance.on('error', async (err: Error): Promise<void> => {
    logger.error({ message: 'Failed to connect to database.', label: 'Keyv' });
    await updateHandler.restart('immediate', 'keyv', err);
});

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
        case 'exit': {
            const strategy = input.split(' ')[1] ?? 'immediate';
            if (
                strategy !== 'immediate' &&
                strategy !== 'track' &&
                strategy !== 'queue'
            ) {
                console.log('Usage: exit [immediate|track|queue]');
                break;
            }
            await updateHandler.restart(strategy, 'exit');
            break;
        }
        case 'update':
            if (updateHandler.channel === 'none') {
                console.log('Automatic updates are disabled.');
                break;
            }
            if (updateHandler.restartInProgress) {
                console.log('An update or restart is already in progress.');
                break;
            }
            if (!version.official) {
                console.log(
                    'Automatic updates are disabled for unofficial builds.',
                );
                break;
            }
            console.log('Triggering an update check...');
            await updateHandler.checkForUpdates();
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
            console.log(
                'Available commands: exit, update, sessions, whitelist, stats',
            );
            break;
    }
});
// 'close' event catches ctrl+c, therefore we pass it to shuttingDown as a ctrl+c event
rl.on(
    'close',
    async (): Promise<void> => updateHandler.restart('immediate', 'SIGINT'),
);

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
            (...args: unknown[]): void | Promise<void> =>
                event.default.execute(...args),
        );
    } else {
        client.music.on(
            event.default.name as keyof ClientEvents,
            (...args: unknown[]): void | Promise<void> =>
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
        async (err): Promise<void> =>
            updateHandler.restartInProgress
                ? null
                : updateHandler.restart('immediate', eventType, err),
    );
});
