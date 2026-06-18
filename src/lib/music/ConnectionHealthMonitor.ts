import type { QuaverClient } from '#src/lib';
import { logger } from '#src/lib/logger';
import { settings } from '../util';
import type { RegionAffinity } from './RegionAffinity';

export type GatewayHealthData = {
    averagePing: number;
    minPing: number;
    maxPing: number;
    unstable: boolean;
    reconnectCount: number;
    lastEndpoint: string;
    timestamp: number;
};

export type MediaHealthData = {
    endpoint: string | null;
    latencyMs: number | null;
    unstable: boolean;
    consecutiveFailures: number;
    lastCheckTimestamp: number;
};

type ConnectionHealthConfig = {
    gateway: {
        unstablePingThresholdMs: number;
        unstableReconnectThreshold: number;
        sampleIntervalSeconds: number;
        sampleWindowSize: number;
    };
    media: {
        checkIntervalSeconds: number;
        unstableLatencyMs: number;
        consecutiveFailureThreshold: number;
        checkTimeoutMs: number;
    };
};

export class ConnectionHealthMonitor {
    private client: QuaverClient;
    private config: ConnectionHealthConfig;
    private regionAffinity: RegionAffinity | null;

    // Gateway health tracking
    private pingSamples: number[] = [];
    private reconnectCount = 0;
    private reconnectTimestamps: number[] = [];
    private gatewayPingInterval?: ReturnType<typeof setInterval>;
    private lastGatewayEndpoint = 'gateway.discord.gg';

    // Media server health tracking
    private mediaEndpoint: string | null = null;
    private currentNodeId: string | null = null;
    private mediaLatencySamples: (number | null)[] = [];
    private mediaConsecutiveFailures = 0;
    private mediaCheckInterval?: ReturnType<typeof setInterval>;
    private lastMediaCheckTimestamp = 0;

    // Bound event listeners for cleanup
    private onReady = (): void => {
        logger.debug('Gateway ready event received');
    };

    private onShardDisconnect = (): void => {
        const now = Date.now();
        this.reconnectTimestamps.push(now);
        this.reconnectTimestamps = this.reconnectTimestamps.filter(
            (ts): boolean => now - ts < 5 * 60 * 1000,
        );
        this.reconnectCount = this.reconnectTimestamps.length;
        logger.info(
            `Gateway disconnected. Reconnect count (last 5 min): ${this.reconnectCount}`,
        );
        this.emitGatewayHealthUpdate();
    };

    private onShardReconnecting = (): void => {
        logger.info('Gateway reconnecting...');
    };

    private onShardResume = (): void => {
        logger.info('Gateway resumed');
        this.emitGatewayHealthUpdate();
    };

    constructor(client: QuaverClient, regionAffinity: RegionAffinity | null = null) {
        this.client = client;
        this.regionAffinity = regionAffinity;
        this.config = this.loadConfig();
        this.initializeGatewayMonitoring();
        this.initializeMediaMonitoring();
    }

    /**
     * Extracts the region prefix from a Discord media endpoint URL.
     * Example: 'c-sin13-f16265ef.discord.media' -> 'c-sin'
     */
    private static extractRegionPrefix(endpoint: string): string {
        // Remove protocol if present
        const cleaned = endpoint.replace(/^https?:\/\//, '');
        // Extract the region prefix (e.g., 'c-sin' from 'c-sin13-f16265ef.discord.media')
        const match = cleaned.match(/^([a-z]+-[a-z]+)/);
        return match ? match[1] : 'unknown';
    }

    private loadConfig(): ConnectionHealthConfig {
        const userConfig = (settings as Record<string, unknown>)
            .connectionHealth as ConnectionHealthConfig | undefined;

        // Defensively merge config to handle partial user configuration
        return {
            gateway: {
                unstablePingThresholdMs: userConfig?.gateway?.unstablePingThresholdMs ?? 500,
                unstableReconnectThreshold: userConfig?.gateway?.unstableReconnectThreshold ?? 5,
                sampleIntervalSeconds: userConfig?.gateway?.sampleIntervalSeconds ?? 10,
                sampleWindowSize: userConfig?.gateway?.sampleWindowSize ?? 20,
            },
            media: {
                checkIntervalSeconds: userConfig?.media?.checkIntervalSeconds ?? 60,
                unstableLatencyMs: userConfig?.media?.unstableLatencyMs ?? 2000,
                consecutiveFailureThreshold: userConfig?.media?.consecutiveFailureThreshold ?? 3,
                checkTimeoutMs: userConfig?.media?.checkTimeoutMs ?? 2000,
            },
        };
    }

    /**
     * Sets the RegionAffinity instance for tracking ping-based node selection.
     * This is called after initialization when multi-node configuration is detected.
     */
    public setRegionAffinity(regionAffinity: RegionAffinity | null): void {
        this.regionAffinity = regionAffinity;
    }

    private initializeGatewayMonitoring(): void {
        // Register bound event listeners so they can be removed during cleanup
        this.client.ws.on('ready' as never, this.onReady);
        this.client.on('shardDisconnect', this.onShardDisconnect);
        this.client.on('shardReconnecting', this.onShardReconnecting);
        this.client.on('shardResume', this.onShardResume);

        // Periodically sample ping
        this.gatewayPingInterval = setInterval((): void => {
            const ping = this.client.ws.ping;
            if (ping > 0) {
                this.pingSamples.push(ping);
                // Keep only the last N samples
                if (
                    this.pingSamples.length >
                    this.config.gateway.sampleWindowSize
                ) {
                    this.pingSamples.shift();
                }
                this.emitGatewayHealthUpdate();
            }
        }, this.config.gateway.sampleIntervalSeconds * 1000);
    }

    private initializeMediaMonitoring(): void {
        // Media health checks will start once we have an endpoint
        this.mediaCheckInterval = setInterval((): void => {
            if (this.mediaEndpoint) {
                void this.checkMediaServerHealth();
            }
        }, this.config.media.checkIntervalSeconds * 1000);
    }

    private async checkMediaServerHealth(): Promise<void> {
        if (!this.mediaEndpoint) return;

        const startTime = Date.now();
        this.lastMediaCheckTimestamp = startTime;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        try {
            // Attempt a simple HTTP HEAD request to check if the endpoint is reachable
            const controller = new AbortController();
            timeoutId = setTimeout(
                (): void => controller.abort(),
                this.config.media.checkTimeoutMs,
            );

            const response = await fetch(`https://${this.mediaEndpoint}/`, {
                method: 'HEAD',
                signal: controller.signal,
            });

            const latency = Date.now() - startTime;
            this.mediaLatencySamples.push(latency);

            if (this.mediaLatencySamples.length > 10) {
                this.mediaLatencySamples.shift();
            }

            if (response.ok) {
                this.mediaConsecutiveFailures = 0;
                logger.debug(
                    `Media server health check OK: ${this.mediaEndpoint} (${latency}ms)`,
                );

                // Update region affinity if enabled
                if (this.regionAffinity && this.currentNodeId && this.mediaEndpoint) {
                    const regionPrefix = ConnectionHealthMonitor.extractRegionPrefix(this.mediaEndpoint);
                    await this.regionAffinity.upsertAffinity(this.currentNodeId, regionPrefix, latency);
                    logger.debug(
                        `Updated region affinity: node=${this.currentNodeId}, region=${regionPrefix}, ping=${latency}ms`,
                    );
                }
            } else {
                this.mediaConsecutiveFailures++;
                logger.warn(
                    `Media server health check failed: ${this.mediaEndpoint} (status: ${response.status})`,
                );
            }
        } catch (error) {
            this.mediaConsecutiveFailures++;
            this.mediaLatencySamples.push(null);

            if (this.mediaLatencySamples.length > 10) {
                this.mediaLatencySamples.shift();
            }

            logger.warn(
                `Media server health check error: ${this.mediaEndpoint} - ${error instanceof Error ? error.message : String(error)}`,
            );
        } finally {
            // Always clear timeout to prevent memory leaks
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }

        this.emitMediaHealthUpdate();
    }

    public updateMediaEndpoint(endpoint: string | null, nodeId: string | null = null): void {
        if (endpoint === null && this.mediaEndpoint !== null) {
            logger.info('Media server endpoint cleared, stopping health checks');
            this.mediaEndpoint = null;
            this.currentNodeId = null;
            this.mediaConsecutiveFailures = 0;
            this.mediaLatencySamples = [];
            this.lastMediaCheckTimestamp = Date.now();
            this.emitMediaHealthUpdate();
            return;
        }

        if (endpoint && endpoint !== this.mediaEndpoint) {
            logger.info(`Media server endpoint updated: ${endpoint} (node: ${nodeId ?? 'unknown'})`);
            this.mediaEndpoint = endpoint;
            this.currentNodeId = nodeId;
            this.mediaConsecutiveFailures = 0;
            this.mediaLatencySamples = [];
            // Trigger an immediate health check
            void this.checkMediaServerHealth();
        }
    }

    private emitGatewayHealthUpdate(): void {
        const data = this.getGatewayHealth();
        this.client.emit('gatewayHealthUpdate', data);
    }

    private emitMediaHealthUpdate(): void {
        const data = this.getMediaHealth();
        this.client.emit('mediaHealthUpdate', data);
    }

    public getGatewayHealth(): GatewayHealthData {
        // Dynamically filter timestamps to ensure reconnectCount decays over time
        const now = Date.now();
        this.reconnectTimestamps = this.reconnectTimestamps.filter(
            (ts): boolean => now - ts < 5 * 60 * 1000,
        );
        this.reconnectCount = this.reconnectTimestamps.length;

        const validSamples = this.pingSamples.filter(
            (p): boolean => p > 0 && p < 10000,
        );

        let averagePing = 0;
        let minPing = 0;
        let maxPing = 0;

        if (validSamples.length > 0) {
            averagePing = Math.round(
                validSamples.reduce((a, b): number => a + b, 0) /
                    validSamples.length,
            );
            minPing = Math.min(...validSamples);
            maxPing = Math.max(...validSamples);
        }

        const unstable =
            averagePing > this.config.gateway.unstablePingThresholdMs ||
            this.reconnectCount >= this.config.gateway.unstableReconnectThreshold;

        return {
            averagePing,
            minPing,
            maxPing,
            unstable,
            reconnectCount: this.reconnectCount,
            lastEndpoint: this.lastGatewayEndpoint,
            timestamp: now,
        };
    }

    public getMediaHealth(): MediaHealthData {
        const validLatencies = this.mediaLatencySamples.filter(
            (l): l is number => l !== null,
        );

        let latencyMs: number | null = null;
        if (validLatencies.length > 0) {
            latencyMs = Math.round(
                validLatencies.reduce((a, b): number => a + b, 0) /
                    validLatencies.length,
            );
        }

        const unstable =
            this.mediaConsecutiveFailures >=
                this.config.media.consecutiveFailureThreshold ||
            (latencyMs !== null &&
                latencyMs > this.config.media.unstableLatencyMs);

        return {
            endpoint: this.mediaEndpoint,
            latencyMs,
            unstable,
            consecutiveFailures: this.mediaConsecutiveFailures,
            lastCheckTimestamp: this.lastMediaCheckTimestamp,
        };
    }

    public destroy(): void {
        // Clear intervals
        if (this.gatewayPingInterval) {
            clearInterval(this.gatewayPingInterval);
        }
        if (this.mediaCheckInterval) {
            clearInterval(this.mediaCheckInterval);
        }
        // Remove event listeners to prevent memory leaks
        this.client.ws.off('ready' as never, this.onReady);
        this.client.off('shardDisconnect', this.onShardDisconnect);
        this.client.off('shardReconnecting', this.onShardReconnecting);
        this.client.off('shardResume', this.onShardResume);
        logger.info('ConnectionHealthMonitor destroyed');
    }
}
