import { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import type { QuaverPlayerJSON } from '#src/lib/music';
import type { QuaverClient } from '#src/lib/QuaverClient';
import { MessageOptionsBuilderType } from '#src/lib/ReplyHandler';
import { startup } from '#src/lib/state';
import { settings, version } from '#src/lib/util';
import AdmZip from 'adm-zip';
import { ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { writeFile } from 'node:fs/promises';
import semver from 'semver';

type APIReleaseAuthor = {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    user_view_type: string;
    site_admin: boolean;
};

type APIReleaseAssets = {
    url: string;
    id: number;
    node_id: string;
    name: string;
    label: string;
    uploader: APIReleaseAuthor;
    content_type: string;
    state: string;
    size: number;
    digest: string;
    download_count: number;
    created_at: string;
    updated_at: string;
    browser_download_url: string;
};

type APIRelease = {
    url: string;
    assets_url: string;
    upload_url: string;
    html_url: string;
    id: number;
    author: APIReleaseAuthor;
    node_id: string;
    tag_name: string;
    target_commitish: string;
    name: string;
    draft: boolean;
    immutable: boolean;
    prerelease: boolean;
    created_at: string;
    updated_at: string;
    published_at: string;
    assets: APIReleaseAssets[];
    tarball_url: string;
    zipball_url: string;
    body: string;
};

export class UpdateHandler {
    // Channel to update from - none means update checker is disabled
    channel = settings.updater?.channel ?? 'none';
    // Whether to download and replace files when an update is found
    install = settings.updater?.install ?? false;
    // Whether to restart the application after an update is installed
    restartStrategy = settings.updater?.restartStrategy ?? 'none';
    restartInProgress = false;
    private restartTimeout: NodeJS.Timeout | null = null;
    private restartInterval: NodeJS.Timeout | null = null;
    private updateInterval: NodeJS.Timeout | null = null;

    constructor(private client: QuaverClient) {
        this.client = client;
        if (this.channel !== 'none' && version.official) {
            this.updateInterval = setInterval(
                (): void => {
                    this.checkForUpdates().catch((error): void => {
                        logger.error(
                            `Encountered error while checking for updates: ${error.message}\n${error.stack}`,
                        );
                    });
                },
                30 * 60 * 1000,
            );
            logger.info(
                `Update checker initialized on '${this.channel}' channel.`,
            );
            this.checkForUpdates().catch((error): void => {
                logger.error(
                    `Encountered error while checking for updates: ${error.message}\n${error.stack}`,
                );
            });
        } else if (!version.official) {
            logger.info(
                'Update checker is disabled as this is not an official build.',
            );
        }
    }

    async checkForUpdates(): Promise<void> {
        if (this.channel === 'none') return;
        if (!version.official) return;
        const res = await fetch(
            'https://api.github.com/repos/ZPTXDev/Quaver/releases',
        );
        if (!res.ok) {
            logger.warn(
                `Update check failed with status ${res.status} ${res.statusText}`,
            );
            return;
        }
        const releases = await res.json();
        if (!Array.isArray(releases) || releases.length < 1) {
            logger.warn('Update check returned no releases.');
            return;
        }
        const filtered = releases.filter((release: APIRelease): boolean =>
            release.assets.some(
                (asset): boolean => asset.name === 'quaver-release.zip',
            ) && this.channel === 'next'
                ? ['next', 'staging', 'master'].includes(
                      release.target_commitish,
                  )
                : this.channel === 'staging'
                  ? ['staging', 'master'].includes(release.target_commitish)
                  : release.target_commitish === 'master',
        );
        const sorted = semver.rsort(
            filtered.map((release: APIRelease): string => release.tag_name),
        );
        if (semver.gt(sorted[0], version.version)) {
            logger.info(
                `New version available: ${sorted[0]} (current: ${version.version})`,
            );
            if (this.install) {
                const release = filtered.find(
                    (r: APIRelease): boolean => r.tag_name === sorted[0],
                );
                await this.installUpdate(release);
            }
        }
    }

    async installUpdate(release: APIRelease): Promise<void> {
        logger.info(`Downloading update ${release.tag_name}...`);
        const asset = release.assets.find(
            (a): boolean => a.name === 'quaver-release.zip',
        );
        if (!asset) {
            logger.error(
                'Update asset not found. Aborting update installation.',
            );
            return;
        }
        const res = await fetch(asset.browser_download_url);
        if (!res.ok) {
            logger.error(
                `Failed to download update asset with status ${res.status} ${res.statusText}. Aborting update installation.`,
            );
            return;
        }
        const buffer = await res.arrayBuffer();
        logger.info('Extracting update...');
        const zip = new AdmZip(Buffer.from(buffer));
        zip.extractAllTo('.', true);
        logger.info('Update installed successfully.');
        clearInterval(this.updateInterval);
        delete this.updateInterval;
        await this.restart(this.restartStrategy, 'update');
    }

    checkRestartable(): boolean {
        if (this.restartStrategy === 'immediate') return true;
        const players = this.client.music.players;
        for (const pair of players.cache) {
            const player = pair[1];
            if (!player.restartReady) return false;
        }
        return true;
    }

    async restart(
        strategy = this.restartStrategy,
        eventType?: string,
        err?: Error,
    ): Promise<void> {
        if (strategy === 'none') return;
        this.restartStrategy = strategy;
        if (this.restartInProgress) {
            logger.info(
                `Restart already in progress, aborting duplicate call with event type '${eventType}' and strategy '${strategy}'...`,
            );
            return;
        }
        this.restartInProgress = true;
        logger.info(
            `Restarting${eventType ? ` due to '${eventType}'` : ''}${strategy !== 'immediate' ? ` using '${strategy}' strategy` : ''}...`,
        );
        const restartable = this.checkRestartable();
        if (strategy !== 'immediate' && !restartable) {
            this.restartTimeout = setTimeout(
                async (): Promise<void> => {
                    logger.warn('Restart timeout reached, forcing restart...');
                    this.restartInProgress = false;
                    return this.restart('immediate', eventType);
                },
                (strategy === 'track' ? 5 : 30) * 60_000,
            );
            this.restartInterval = setInterval(async (): Promise<void> => {
                const res = this.checkRestartable();
                if (res) {
                    logger.info(
                        'All players ready, proceeding with restart...',
                    );
                    if (this.restartTimeout) {
                        clearTimeout(this.restartTimeout);
                        delete this.restartTimeout;
                    }
                    if (this.restartInterval) {
                        clearInterval(this.restartInterval);
                        delete this.restartInterval;
                    }
                    this.restartInProgress = false;
                    return this.restart('immediate', eventType);
                }
            }, 10_000);
            return;
        }
        try {
            if (startup.started) {
                const players = this.client.music.players;
                if (players.cache.size < 1) return;
                const states: Record<string, QuaverPlayerJSON> = {};
                logger.info('Disconnecting from all guilds...');
                for (const pair of players.cache) {
                    const player = pair[1];
                    states[player.guild.id] = player.toJSON();
                    const guild = await QuaverGuild.wrap(player.guild);
                    logger.info(`[G ${guild.id}] Disconnecting (restarting)`);
                    await player.disconnect();
                    await player.sendMessage(
                        new ContainerBuilder().addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${guild.locale(
                                    [
                                        'exit',
                                        'update',
                                        'SIGINT',
                                        'SIGTERM',
                                        'lavalink',
                                    ].includes(eventType)
                                        ? 'MUSIC.PLAYER.RESTARTING.DEFAULT'
                                        : 'MUSIC.PLAYER.RESTARTING.CRASHED',
                                )}`,
                            ),
                            guild.builders.textDisplayLocale(
                                'MUSIC.PLAYER.RESTARTING.SESSION_RECOVERY_EXPLANATION',
                            ),
                            guild.builders.textDisplayLocale(
                                'MUSIC.PLAYER.RESTARTING.APOLOGY',
                            ),
                        ),
                        { type: MessageOptionsBuilderType.Warning },
                    );
                }
                await writeFile('states.json', JSON.stringify(states, null, 4));
            }
        } catch (error) {
            if (error instanceof Error) {
                logger.error('Encountered error while shutting down.');
                logger.error(`${error.message}\n${error.stack}`);
            }
        } finally {
            if (
                !['exit', 'update', 'SIGINT', 'SIGTERM'].includes(eventType) &&
                err instanceof Error
            ) {
                logger.error(`${err.message}\n${err.stack}`);
                logger.info('Logging additional output to error.log.');
                try {
                    await writeFile(
                        'error.log',
                        `${eventType}${err.message ? `\n${err.message}` : ''}${
                            err.stack ? `\n${err.stack}` : ''
                        }`,
                    );
                } catch (e) {
                    if (e instanceof Error) {
                        logger.error(
                            'Encountered error while writing to error.log.',
                        );
                        logger.error(`${e.message}\n${e.stack}`);
                    }
                }
            }
            await this.client.destroy();
            process.exit();
        }
    }
}
