import { load as effectsLoad } from '@lavaclient/plugin-effects';
import { load as queueLoad } from '@lavaclient/plugin-queue';
import { getAbsoluteFileURL, msToTime, msToTimeString, parseTimeString, } from '@zptxdev/zptx-lib';
import { createCache } from 'cache-manager';
import { KeyvCacheableMemory } from 'cacheable';
import { Collection, GatewayIntentBits, type Guild, PermissionsBitField } from 'discord.js';
import { default as express, type Express, type Request, type Response } from 'express';
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
import { PremiumSweepService, QuaverClient } from './lib';
import { data, DataHandler } from './lib/data';
import { QuaverGuild, type WhitelistedFeatures, WhitelistStatus, type Initialized } from './lib/guild';
import type { InteractionHandlerMapsFlat } from './lib/interactions';
import { setLocales } from './lib/locales';
import { logger } from './lib/logger';
import type { QuaverNode, QuaverPlayer } from './lib/music';
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
    if (settings.grafanaLogging) {
        logger.info(
            `Grafana logging is ${colors.green('enabled')}. Statistics will be accessible through the /stats endpoint.`,
        );
    }
    spinner.start(`Starting ${colors.cyan('web server')}`);
    app = express();
    app.use(express.json());
    if (settings.features.web.apiSecret) {
        app.use('/api/premium', (req, res, next): void => {
            const origin = req.headers.origin;
            if (origin) {
                if (settings.features.web.allowedOrigins.includes(origin)) {
                    res.setHeader('Access-Control-Allow-Origin', origin);
                    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                } else {
                    res.status(403).send({ error: 'Forbidden by CORS policy' });
                    return;
                }
            }
            if (req.method === 'OPTIONS') {
                res.sendStatus(204);
                return;
            }
            next();
        });

        const getGuildPremiumStatus = async (
            guild: QuaverGuild<Initialized>,
        ): Promise<Record<string, { status: string; expires: number | null }>> => {
            const featuresList = ['premium', 'stay', 'autolyrics', 'smartqueue'] as const;
            const featuresStatus: Record<string, { status: string; expires: number | null }> = {};

            for (const feature of featuresList) {
                const status = await guild.features.checkWhitelisted(feature);
                let usesPremiumStore = false;
                if (feature === 'premium') {
                    usesPremiumStore = true;
                } else {
                    usesPremiumStore = !!(
                        settings.premiumEnabled &&
                        settings.features[feature].premium
                    );
                }
                const featureStore = usesPremiumStore
                    ? 'premium'
                    : `${feature}.whitelisted`;

                const expires = await guild.features.get<number>(featureStore);

                let statusString = 'NotWhitelisted';
                if (status === WhitelistStatus.Permanent) {
                    statusString = 'Permanent';
                } else if (status === WhitelistStatus.Temporary) {
                    statusString = 'Temporary';
                } else if (status === WhitelistStatus.Expired) {
                    statusString = 'Expired';
                }

                featuresStatus[feature] = {
                    status: statusString,
                    expires: expires !== undefined ? expires : null,
                };
            }
            return featuresStatus;
        };

        // Lock map to serialize whitelist writes per guild/feature combination
        const whitelistLocks = new Map<string, Promise<void>>();

        // Execute a function with an exclusive lock on a guild/feature pair
        const withWhitelistLock = async <T>(guildId: string, feature: string, fn: () => Promise<T>): Promise<T> => {
            const lockKey = `${guildId}:${feature}`;

            // Wait for any existing lock on this guild/feature
            while (whitelistLocks.has(lockKey)) {
                await whitelistLocks.get(lockKey);
            }

            // Create new lock
            let releaseLock: () => void;
            const lockPromise = new Promise<void>((resolve: () => void): void => { releaseLock = resolve; });
            whitelistLocks.set(lockKey, lockPromise);

            try {
                return await fn();
            } finally {
                whitelistLocks.delete(lockKey);
                releaseLock!();
            }
        };

        // Helper to validate whitelist request and send appropriate responses
        const validateWhitelistRequest = (req: Request, res: Response): { valid: boolean, guildId?: string, feature?: string, durationMs?: number, sessionId?: string } => {
            if (!startup.started) {
                res.status(503).send({ error: 'Service is starting up, please try again later' });
                return { valid: false };
            }
            const authHeader = req.headers.authorization;
            if (!authHeader || authHeader !== `Bearer ${settings.features.web.apiSecret}`) {
                res.status(401).send({ error: 'Unauthorized' });
                return { valid: false };
            }
            if (!req.body || typeof req.body !== 'object') {
                res.status(400).send({ error: 'Invalid or missing request body' });
                return { valid: false };
            }
            const { guildId, feature, durationMs, sessionId } = req.body;
            if (typeof guildId !== 'string' || typeof feature !== 'string' || typeof durationMs !== 'number') {
                res.status(400).send({ error: 'guildId and feature must be strings, and durationMs must be a number' });
                return { valid: false };
            }
            if (sessionId !== undefined && typeof sessionId !== 'string') {
                res.status(400).send({ error: 'sessionId must be a string if provided' });
                return { valid: false };
            }
            if (!Number.isFinite(durationMs)) {
                res.status(400).send({ error: 'durationMs must be a finite number' });
                return { valid: false };
            }
            if (durationMs < -1) {
                res.status(400).send({ error: 'durationMs must be -1 or greater' });
                return { valid: false };
            }
            if (!['premium', 'stay', 'autolyrics', 'smartqueue'].includes(feature)) {
                res.status(400).send({ error: 'Invalid feature name' });
                return { valid: false };
            }
            return { valid: true, guildId, feature, durationMs, sessionId };
        };

        // Determine which feature store to use based on feature and premium config
        const resolveFeatureStore = (feature: string): string => {
            const usesPremiumStore =
                feature === 'premium' ||
                (feature !== 'premium' &&
                    settings.premiumEnabled &&
                    settings.features[feature as WhitelistedFeatures].premium);
            return usesPremiumStore ? 'premium' : `${feature}.whitelisted`;
        };

        // Compute new expiry timestamp based on current expiry and requested duration
        const computeNewExpiry = (currentExpiry: number | undefined, durationMs: number): number => {
            if (durationMs === -1) return -1;
            if (currentExpiry === -1) return -1;
            if (currentExpiry && currentExpiry > Date.now()) {
                return currentExpiry + durationMs;
            }
            return Date.now() + durationMs;
        };

        // Check if a user has admin permissions (owner, Administrator, or ManageGuild) in a guild
        const checkUserAdminPermissions = async (discordGuild: Guild, userId: string): Promise<{ isOwner: boolean; isAdmin: boolean }> => {
            const isOwner = discordGuild.ownerId === userId;
            if (isOwner) {
                return { isOwner: true, isAdmin: true };
            }

            try {
                const member = await discordGuild.members.fetch(userId);
                if (member) {
                    const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator) ||
                        member.permissions.has(PermissionsBitField.Flags.ManageGuild);
                    return { isOwner: false, isAdmin };
                }
            } catch {
                // Member not found or couldn't fetch
            }
            return { isOwner: false, isAdmin: false };
        };

        // Process guild data for a specific user, including permission checks and premium status
        const processUserGuildData = async (guildId: string, userId: string): Promise<Record<string, unknown>> => {
            const discordGuild = client.guilds.cache.get(guildId);
            if (!discordGuild) {
                return {
                    guildId,
                    botInGuild: false,
                };
            }

            const { isOwner, isAdmin } = await checkUserAdminPermissions(discordGuild, userId);

            const guild = await QuaverGuild.wrap(discordGuild);
            if (!guild) {
                return {
                    guildId,
                    botInGuild: false,
                };
            }

            const features = await getGuildPremiumStatus(guild);
            return {
                guildId,
                name: guild.name,
                icon: discordGuild.iconURL(),
                botInGuild: true,
                owner: isOwner,
                isAdmin,
                features,
            };
        };

        app.post('/api/premium/whitelist', async (req, res): Promise<void> => {
            const validation = validateWhitelistRequest(req, res);
            if (!validation.valid) return;
            const { guildId, feature, durationMs, sessionId } = validation;

            // Fetch guild
            let discordGuild;
            try {
                discordGuild = await client.guilds.fetch(guildId);
            } catch {
                res.status(404).send({ error: 'Guild not found or bot not in guild' });
                return;
            }
            const guild = await QuaverGuild.wrap(discordGuild);
            if (!guild) {
                res.status(404).send({ error: 'Guild wrapping failed' });
                return;
            }

            // Serialize all reads and writes for this guild/feature under a lock
            const result = await withWhitelistLock(guildId, feature, async (): Promise<{ alreadyProcessed: boolean; expires: number | null; wasActive: boolean }> => {
                const featureStore = resolveFeatureStore(feature);
                const currentExpiry = await guild.features.get<number>(featureStore);
                const wasActive = currentExpiry !== undefined && (currentExpiry === -1 || currentExpiry > Date.now());

                // Idempotent session handling
                if (sessionId) {
                    const alreadyProcessed = await guild.features.get<boolean>(`processedTransactions.${sessionId}`);
                    if (alreadyProcessed) {
                        return {
                            alreadyProcessed: true,
                            expires: currentExpiry !== undefined ? currentExpiry : null,
                            wasActive,
                        };
                    }
                }

                const newExpiry = computeNewExpiry(currentExpiry, durationMs);
                await guild.features.set(featureStore, newExpiry);

                // Mark as processed only after successful entitlement write
                if (sessionId) {
                    await guild.features.set(`processedTransactions.${sessionId}`, true);
                }

                return {
                    alreadyProcessed: false,
                    expires: newExpiry,
                    wasActive,
                };
            });

            // Fire-and-forget: re-enable features for active players after premium renewal
            // Only restore features if premium was not already active (i.e., transitioning from inactive to active)
            if (!result.alreadyProcessed && !result.wasActive) {
                void PremiumSweepService.restoreFeatures(guildId);
            }

            res.send({
                success: true,
                guildName: guild.name,
                feature,
                expires: result.expires,
                ...(result.alreadyProcessed && { alreadyProcessed: true }),
            });


        });

        app.get('/api/premium/status/:guildId', async (req, res): Promise<void> => {
            if (!startup.started) {
                res.status(503).send({ error: 'Service is starting up, please try again later' });
                return;
            }
            const authHeader = req.headers.authorization;
            if (!authHeader || authHeader !== `Bearer ${settings.features.web.apiSecret}`) {
                res.status(401).send({ error: 'Unauthorized' });
                return;
            }
            const { guildId } = req.params;
            if (!guildId) {
                res.status(400).send({ error: 'Missing guildId parameter' });
                return;
            }
            let discordGuild;
            try {
                discordGuild = await client.guilds.fetch(guildId);
            } catch {
                res.status(404).send({ error: 'Guild not found or bot not in guild' });
                return;
            }
            const guild = await QuaverGuild.wrap(discordGuild);
            if (!guild) {
                res.status(404).send({ error: 'Guild wrapping failed' });
                return;
            }
            const features = await getGuildPremiumStatus(guild);
            res.send({
                guildId: guild.id,
                name: guild.name,
                icon: discordGuild.iconURL(),
                features,
            });
        });

        app.get('/api/premium/users/:userId/guilds', async (req, res): Promise<void> => {
            if (!startup.started) {
                res.status(503).send({ error: 'Service is starting up, please try again later' });
                return;
            }
            const authHeader = req.headers.authorization;
            if (!authHeader || authHeader !== `Bearer ${settings.features.web.apiSecret}`) {
                res.status(401).send({ error: 'Unauthorized' });
                return;
            }
            const { userId } = req.params;
            if (!userId) {
                res.status(400).send({ error: 'Missing userId parameter' });
                return;
            }

            const ownedGuilds = client.guilds.cache.filter((g): boolean => g.ownerId === userId);
            const guildsData = [];
            for (const discordGuild of ownedGuilds.values()) {
                const guild = await QuaverGuild.wrap(discordGuild);
                if (!guild) continue;
                const features = await getGuildPremiumStatus(guild);
                guildsData.push({
                    guildId: guild.id,
                    name: guild.name,
                    icon: discordGuild.iconURL(),
                    owner: true,
                    features,
                });
            }
            res.send(guildsData);
        });

        app.post('/api/premium/users/:userId/guilds', async (req, res): Promise<void> => {
            if (!startup.started) {
                res.status(503).send({ error: 'Service is starting up, please try again later' });
                return;
            }
            const authHeader = req.headers.authorization;
            if (!authHeader || authHeader !== `Bearer ${settings.features.web.apiSecret}`) {
                res.status(401).send({ error: 'Unauthorized' });
                return;
            }
            const { userId } = req.params;
            if (!userId) {
                res.status(400).send({ error: 'Missing userId parameter' });
                return;
            }
            if (!req.body || !Array.isArray(req.body.guildIds)) {
                res.status(400).send({ error: 'Invalid or missing guildIds list in request body' });
                return;
            }
            const guildIds = req.body.guildIds;
            if (guildIds.length === 0) {
                res.status(400).send({ error: 'guildIds array cannot be empty' });
                return;
            }
            if (guildIds.length > 100) {
                res.status(400).send({ error: 'guildIds array cannot exceed 100 items' });
                return;
            }
            if (!guildIds.every((id: unknown): boolean => typeof id === 'string')) {
                res.status(400).send({ error: 'All guildIds must be strings' });
                return;
            }

            const guildsData = [];
            for (const guildId of guildIds) {
                const guildData = await processUserGuildData(guildId, userId);
                guildsData.push(guildData);
            }
            res.send(guildsData);
        });

        app.delete('/api/premium/whitelist', async (req, res): Promise<void> => {
            if (!startup.started) {
                res.status(503).send({ error: 'Service is starting up, please try again later' });
                return;
            }
            const authHeader = req.headers.authorization;
            if (!authHeader || authHeader !== `Bearer ${settings.features.web.apiSecret}`) {
                res.status(401).send({ error: 'Unauthorized' });
                return;
            }
            if (!req.body || typeof req.body !== 'object') {
                res.status(400).send({ error: 'Invalid or missing request body' });
                return;
            }
            const { guildId, feature } = req.body;
            if (typeof guildId !== 'string' || typeof feature !== 'string') {
                res.status(400).send({
                    error: 'guildId and feature must be strings',
                });
                return;
            }
            if (!['premium', 'stay', 'autolyrics', 'smartqueue'].includes(feature)) {
                res.status(400).send({ error: 'Invalid feature name' });
                return;
            }
            let discordGuild;
            try {
                discordGuild = await client.guilds.fetch(guildId);
            } catch {
                res.status(404).send({ error: 'Guild not found or bot not in guild' });
                return;
            }
            const guild = await QuaverGuild.wrap(discordGuild);
            if (!guild) {
                res.status(404).send({ error: 'Guild wrapping failed' });
                return;
            }
            const usesPremiumStore =
                feature === 'premium' ||
                (feature !== 'premium' &&
                    settings.premiumEnabled &&
                    settings.features[feature as WhitelistedFeatures].premium);
            const featureStore = usesPremiumStore
                ? 'premium'
                : `${feature}.whitelisted`;

            // Serialize delete with the same lock as POST to prevent race conditions
            await withWhitelistLock(guildId, feature, async (): Promise<void> => {
                await guild.features.unset(featureStore);
            });

            res.send({
                success: true,
                guildName: guild.name,
                feature,
            });
        });
    }
    if (settings.grafanaLogging) {
        app.get('/stats', async (req, res): Promise<void> => {
            const totalSessions = client.music?.players?.cache.size;
            const totalActive = Array.from(
                client.music?.players?.cache.values(),
            ).filter(
                (player: QuaverPlayer<QuaverNode>): boolean =>
                    !player.timeout.standard && !player.timeout.pause,
            ).length;
            const totalQueued = Array.from(
                client.music?.players?.cache.values(),
            ).reduce(
                (total: number, player: QuaverPlayer<QuaverNode>): number =>
                    total + (player.queue?.tracks.length ?? 0),
                0,
            );
            res.send({
                sessions: {
                    total: totalSessions,
                    active: totalActive,
                    idle: totalSessions - totalActive,
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
    !requiredPlugins.every(
        (plugin): boolean => info.plugins.map((p): string => p.name).includes(plugin)
    )
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
    quavermusic: 'qmsearch:',
    deezer: 'dzsearch:',
    youtubemusic: 'ytmsearch:',
    youtube: 'ytsearch:',
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

const consoleCommands: Record<
    string,
    (input: string, command: string) => void | Promise<void>
> = {
    exit: async (input): Promise<void> => {
        const strategy = input.split(' ')[1] ?? 'immediate';
        if (
            strategy !== 'immediate' &&
            strategy !== 'track' &&
            strategy !== 'queue'
        ) {
            console.log('Usage: exit [immediate|track|queue]');
            return;
        }
        await updateHandler.restart(strategy, 'exit');
    },
    update: async (): Promise<void> => {
        if (updateHandler.channel === 'none') {
            console.log('Automatic updates are disabled.');
            return;
        }
        if (updateHandler.restartInProgress) {
            console.log('An update or restart is already in progress.');
            return;
        }
        if (!version.official) {
            console.log(
                'Automatic updates are disabled for unofficial builds.',
            );
            return;
        }
        console.log('Triggering an update check...');
        await updateHandler.checkForUpdates();
    },
    sessions: (): void => {
        console.log(
            `There are currently ${client.music.players.cache.size} active session(s).`,
        );
    },
    stats: (): void => {
        const uptime = msToTime(client.uptime);
        const uptimeString = msToTimeString(uptime);
        console.log(
            `Statistics:\nGuilds: ${client.guilds.cache.size}\nUptime: ${uptimeString}`,
        );
    },
    sweep: async (): Promise<void> => {
        if (!startup.sweepService) {
            console.log('Premium sweep service is not initialized.');
            return;
        }
        console.log('Manually triggering premium/whitelist sweep...');
        await startup.sweepService.sweep();
        console.log('Sweep completed.');
    },
    retry: async (input): Promise<void> => {
        const sessionId = input.split(' ')[1];
        const guildId = input.split(' ')[2];
        const months = parseInt(input.split(' ')[3], 10);

        if (!sessionId || !guildId || !months || isNaN(months)) {
            console.log('Usage: retry <sessionId> <guildId> <months>');
            console.log('Example: retry cs_test_abc123 1234567890 3');
            return;
        }

        if (!settings.premiumEnabled) {
            console.log('Premium is not enabled in settings.');
            return;
        }

        try {
            const discordGuild = await client.guilds.fetch(guildId);
            const guild = await QuaverGuild.wrap(discordGuild);
            if (!guild) {
                console.log('Guild not found.');
                return;
            }

            console.log(`Retrying payment for guild ${guild.name} (${guildId})...`);
            console.log(`Session ID: ${sessionId}`);
            console.log(`Duration: ${months} month(s)`);

            // Convert months to milliseconds
            const durationMs = months * 30 * 24 * 60 * 60 * 1000;

            // Determine feature store (premium always uses 'premium' store)
            const featureStore = 'premium';

            // Get current expiry
            const currentExpiry = await guild.features.get<number>(featureStore);
            const wasActive = currentExpiry !== undefined && (currentExpiry === -1 || currentExpiry > Date.now());

            // Check if already processed (idempotency)
            const alreadyProcessed = await guild.features.get<boolean>(`processedTransactions.${sessionId}`);
            if (alreadyProcessed) {
                console.log('⚠️  This payment has already been processed.');
                console.log(`Current expiry: ${currentExpiry === -1 ? 'Lifetime' : currentExpiry ? new Date(currentExpiry).toISOString() : 'None'}`);
                return;
            }

            // Compute new expiry
            let newExpiry: number;
            if (durationMs === -1) {
                newExpiry = -1;
            } else if (currentExpiry === -1) {
                newExpiry = -1;
            } else if (currentExpiry && currentExpiry > Date.now()) {
                newExpiry = currentExpiry + durationMs;
            } else {
                newExpiry = Date.now() + durationMs;
            }

            // Set the new expiry
            await guild.features.set(featureStore, newExpiry);

            // Mark as processed after successful write
            await guild.features.set(`processedTransactions.${sessionId}`, true);

            console.log('✓ Payment processed successfully!');
            console.log(`New expiry: ${newExpiry === -1 ? 'Lifetime' : new Date(newExpiry).toISOString()}`);

            // Trigger feature restoration if premium was not active before
            if (!wasActive) {
                console.log('Restoring premium features...');
                await PremiumSweepService.restoreFeatures(guildId);
                console.log('Features restored.');
            }
        } catch (error) {
            console.error('Error retrying payment:', error);
        }
    },
    whitelist: async (input): Promise<void> => {
        const guildId = input.split(' ')[1];
        const feature = input.split(' ')[2];
        const duration = input.split(' ')[3];
        let durationMs = -1;
        if (!guildId || !feature) {
            console.log('Usage: whitelist <guildId> <feature> [duration]');
            return;
        }
        const discordGuild = await client.guilds.fetch(guildId);
        const guild = await QuaverGuild.wrap(discordGuild);
        if (!guild) {
            console.log('Guild not found.');
            return;
        }
        if (
            !['premium', 'stay', 'autolyrics', 'smartqueue'].includes(
                feature,
            )
        ) {
            console.log(
                'Available features: premium, stay, autolyrics, smartqueue',
            );
            return;
        }
        let featureName = '';
        switch (feature) {
            case 'premium':
                featureName = 'Premium';
                break;
            case 'stay':
                featureName = '24/7';
                break;
            case 'autolyrics':
                featureName = 'Auto Lyrics';
                break;
            case 'smartqueue':
                featureName = 'Smart Queue';
        }
        if (
            (feature === 'premium' && !settings.premiumEnabled) ||
            (feature !== 'premium' &&
                !settings.features[feature as WhitelistedFeatures]
                    .whitelist)
        ) {
            console.log(`The ${featureName} whitelist is not enabled.`);
            return;
        }
        if (duration) {
            if (!parseTimeString(duration)) {
                console.log('Duration example: 5d1h, 1h30m, 10s');
                return;
            }
            durationMs = parseTimeString(duration);
        }
        const whitelisted = await guild.features.checkWhitelisted(
            feature as WhitelistedFeatures | 'premium',
        );
        const usesPremiumStore =
            feature === 'premium' ||
            (feature !== 'premium' &&
                settings.premiumEnabled &&
                settings.features[feature as WhitelistedFeatures].premium);
        const featureStore = usesPremiumStore
            ? 'premium'
            : `${feature}.whitelisted`;
        if (whitelisted && !duration) {
            await guild.features.unset(featureStore);
            console.log(
                `Removed ${guild.name} from the ${featureName} whitelist.`,
            );
            return;
        }
        await guild.features.set(
            featureStore,
            durationMs === -1 ? durationMs : Date.now() + durationMs,
        );
        console.log(
            `Added ${guild.name} to the ${featureName} whitelist ${durationMs === -1
                ? 'permanently'
                : `for ${msToTimeString(msToTime(durationMs))}`
            }.`,
        );
    },
    eval: async (input, command): Promise<void> => {
        if (!settings.developerMode) {
            console.log('Developer mode is not enabled.');
            return;
        }
        if (!input.substring(command.length + 1)) {
            console.log('No input provided.');
            return;
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
    },
};

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', async (input): Promise<void> => {
    const command = input.split(' ')[0].toLowerCase();
    if (['sessions', 'whitelist'].includes(command) && !startup.started) {
        console.log('Quaver is not initialized yet.');
        return;
    }
    const handler = consoleCommands[command];
    if (handler) {
        await handler(input, command);
    } else {
        console.log(
            'Available commands: exit, update, sessions, whitelist, stats, sweep, retry',
        );
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
