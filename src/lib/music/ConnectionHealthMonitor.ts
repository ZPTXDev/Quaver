import type { QuaverClient } from '#src/lib';
import { logger } from '#src/lib/logger';
import { settings } from '../util';

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

    // Gateway health tracking
    private pingSamples: number[] = [];
    private reconnectCount = 0;
    private reconnectTimestamps: number[] = [];
    private gatewayPingInterval?: ReturnType<typeof setInterval>;
    private lastGatewayEndpoint = 'gateway.discord.gg';

    // Media server health tracking
    private mediaEndpoint: string | null = null;
    private mediaLatencySamples: (number | null)[] = [];
    private mediaConsecutiveFailures = 0;
    private mediaCheckInterval?: ReturnType<typeof setInterval>;
    private lastMediaCheckTimestamp = 0;

    constructor(client: QuaverClient) {
        this.client = client;
        this.config = this.loadConfig();
        this.initializeGatewayMonitoring();
        this.initializeMediaMonitoring();
    }

    private loadConfig(): ConnectionHealthConfig {
        // Zod schema provides defaults, so we only need a fallback if connectionHealth is completely missing
        const userConfig = (settings as Record<string, unknown>)
            .connectionHealth as ConnectionHealthConfig | undefined;

        return (
            userConfig ?? {
                gateway: {
                    unstablePingThresholdMs: 500,
                    unstableReconnectThreshold: 5,
                    sampleIntervalSeconds: 10,
                    sampleWindowSize: 20,
                },
                media: {
                    checkIntervalSeconds: 60,
                    unstableLatencyMs: 2000,
                    consecutiveFailureThreshold: 3,
                    checkTimeoutMs: 2000,
                },
            }
        );
    }

    private initializeGatewayMonitoring(): void {
        // Track reconnection events
        this.client.ws.on('ready' as never, (): void => {
            logger.debug('Gateway ready event received');
        });

        this.client.on('shardDisconnect', (): void => {
            const now = Date.now();
            this.reconnectTimestamps.push(now);
            // Keep only reconnects from the last 5 minutes
            this.reconnectTimestamps = this.reconnectTimestamps.filter(
                (ts): boolean => now - ts < 5 * 60 * 1000,
            );
            this.reconnectCount = this.reconnectTimestamps.length;
            logger.info(
                `Gateway disconnected. Reconnect count (last 5 min): ${this.reconnectCount}`,
            );
            this.emitGatewayHealthUpdate();
        });

        this.client.on('shardReconnecting', (): void => {
            logger.info('Gateway reconnecting...');
        });

        this.client.on('shardResume', (): void => {
            logger.info('Gateway resumed');
            this.emitGatewayHealthUpdate();
        });

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

        try {
            // Attempt a simple HTTP HEAD request to check if the endpoint is reachable
            const controller = new AbortController();
            const timeoutId = setTimeout(
                (): void => controller.abort(),
                this.config.media.checkTimeoutMs,
            );

            const response = await fetch(`https://${this.mediaEndpoint}/`, {
                method: 'HEAD',
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

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
        }

        this.emitMediaHealthUpdate();
    }

    public updateMediaEndpoint(endpoint: string | null): void {
        if (endpoint && endpoint !== this.mediaEndpoint) {
            logger.info(`Media server endpoint updated: ${endpoint}`);
            this.mediaEndpoint = endpoint;
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
            timestamp: Date.now(),
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
        if (this.gatewayPingInterval) {
            clearInterval(this.gatewayPingInterval);
        }
        if (this.mediaCheckInterval) {
            clearInterval(this.mediaCheckInterval);
        }
        logger.info('ConnectionHealthMonitor destroyed');
    }
}
