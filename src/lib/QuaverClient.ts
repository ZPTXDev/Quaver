import { getAbsoluteFileURL } from '@zptxdev/zptx-lib';
import { Client, GatewayDispatchEvents } from 'discord.js';
import { readdirSync } from 'node:fs';
import type { Server } from 'socket.io';
import { MessageOptionsBuilderType } from '.';
import type { EventHandler } from './builders';
import { QuaverGuild } from './guild';
import { InteractionHandler, type InteractionHandlerMapsFlat, } from './interactions';
import { ConnectionHealthMonitor, QuaverNode } from './music';
import { settings } from './util';

export class QuaverClient extends Client {
    io?: Server;
    music?: QuaverNode;
    interactionHandler: InteractionHandler;
    connectionHealth: ConnectionHealthMonitor;
    private lastMediaUnstable: boolean = false;

    constructor(
        io: Server | undefined,
        ...args: ConstructorParameters<typeof Client>
    ) {
        super(...args);
        this.io = io;
        this.interactionHandler = new InteractionHandler(this);
        this.connectionHealth = new ConnectionHealthMonitor(this);
        this.setupHealthEventForwarding();
    }

    connectToMusicNode(): void {
        this.music = new QuaverNode(
            {
                info: {
                    host: settings.lavalink.host,
                    port: settings.lavalink.port,
                    auth: settings.lavalink.password,
                    tls: !!settings.lavalink.secure,
                },
                ws: {
                    reconnecting: {
                        delay: settings.lavalink.reconnect.delay ?? 3000,
                        tries: settings.lavalink.reconnect.tries ?? 5,
                    },
                },
                discord: {
                    sendGatewayCommand: (id, payload): void =>
                        this.guilds.cache.get(id)?.shard?.send(payload),
                },
            },
            this,
        );
        this.ws.on(
            GatewayDispatchEvents.VoiceServerUpdate,
            async (payload): Promise<boolean> => {
                // Capture media server endpoint for health monitoring
                this.connectionHealth.updateMediaEndpoint(
                    payload.endpoint ?? null,
                );
                return this.music.players.handleVoiceUpdate(payload);
            },
        );
        this.ws.on(
            GatewayDispatchEvents.VoiceStateUpdate,
            async (payload): Promise<boolean> =>
                this.music.players.handleVoiceUpdate(payload),
        );
    }

    loadHandlers(
        url: string,
        path: string[],
        type: keyof InteractionHandlerMapsFlat,
    ): Promise<void> {
        return this.interactionHandler.loadHandlers(url, path, type);
    }

    async loadEvents(url: string, path: string[]): Promise<void> {
        const files = readdirSync(getAbsoluteFileURL(url, path)).filter(
            (file): boolean => file.endsWith('.mjs'),
        );
        for await (const file of files) {
            const name = file.slice(0, -4);
            const { default: Handler }: { default: EventHandler<never> } =
                await import(
                    getAbsoluteFileURL(url, [...path, file]).toString()
                );
            if (Handler.once) {
                this.once(name, (...args): void | Promise<void> =>
                    Handler.execute.call(Handler, ...args),
                );
                continue;
            }
            this.on(name, (...args): void | Promise<void> =>
                Handler.execute.call(Handler, ...args),
            );
        }
        // inject interactionCreate event to interactionHandler
        this.on('interactionCreate', (interaction): void =>
            this.interactionHandler
                .getEventHandler()
                .execute.call(this.interactionHandler, interaction),
        );
    }

    private setupHealthEventForwarding(): void {
        // Forward gateway health updates to all guilds with active sessions
        this.on('gatewayHealthUpdate', (data): void => {
            if (!this.io || this.io.engine.clientsCount === 0) return;
            this.guilds.cache.forEach((guild): void => {
                const hasActiveWebSession =
                    (this.io?.sockets.adapter.rooms.get(guild.id)?.size ?? 0) >
                    0;
                if (!hasActiveWebSession) return;
                QuaverGuild.wrap(guild)
                    .then((g): void => {
                        g.sendWebUpdate('gatewayHealthUpdate', data);
                    })
                    .catch((): void => {
                        // Silently ignore if guild wrap fails
                    });
            });
        });

        // Forward media health updates and send notifications when unstable
        this.on('mediaHealthUpdate', (data): void => {
            // Detect transition from stable to unstable
            const transitionedToUnstable =
                !this.lastMediaUnstable && data.unstable;
            this.lastMediaUnstable = data.unstable;

            // Send notification to guilds with active players when transitioning to unstable
            if (transitionedToUnstable && data.endpoint) {
                this.guilds.cache.forEach((guild): void => {
                    QuaverGuild.wrap(guild)
                        .then(async (g): Promise<void> => {
                            // Forward to dashboard if active
                            const hasActiveWebSession =
                                (this.io?.sockets.adapter.rooms.get(guild.id)
                                    ?.size ?? 0) > 0;
                            if (hasActiveWebSession) {
                                g.sendWebUpdate('mediaHealthUpdate', data);
                            }

                            // Check if guild has an active player
                            const player = await this.music?.players.fetch(
                                guild.id,
                            );
                            if (
                                player?.voice.connected &&
                                player.queue.channel
                            ) {
                                // Send warning message to the player's bound text channel
                                await player.sendMessage(
                                    g.locale(
                                        'MUSIC.PLAYER.CONNECTION_UNSTABLE',
                                    ),
                                    {
                                        type: MessageOptionsBuilderType.Warning,
                                    },
                                );
                            }
                        })
                        .catch((): void => {
                            // Silently ignore if guild wrap fails
                        });
                });
            } else {
                if (!this.io || this.io.engine.clientsCount === 0) return;
                // Just forward to dashboard if not transitioning to unstable and active
                this.guilds.cache.forEach((guild): void => {
                    const hasActiveWebSession =
                        (this.io?.sockets.adapter.rooms.get(guild.id)?.size ??
                            0) > 0;
                    if (!hasActiveWebSession) return;
                    QuaverGuild.wrap(guild)
                        .then((g): void => {
                            g.sendWebUpdate('mediaHealthUpdate', data);
                        })
                        .catch((): void => {
                            // Silently ignore if guild wrap fails
                        });
                });
            }
        });
    }

    async destroy(): Promise<void> {
        this.connectionHealth.destroy();
        await super.destroy();
    }
}
