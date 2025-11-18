import { getAbsoluteFileURL } from '@zptxdev/zptx-lib';
import { Client, GatewayDispatchEvents } from 'discord.js';
import { readdirSync } from 'node:fs';
import type { Server } from 'socket.io';
import { InteractionHandler, type InteractionHandlerMapsFlat } from '.';
import type { EventHandler } from './builders';
import { QuaverNode } from './music';
import { settings } from './util/settings';

export class QuaverClient extends Client {
    io?: Server;
    music?: QuaverNode;
    interactionHandler: InteractionHandler;

    constructor(
        io: Server | undefined,
        ...args: ConstructorParameters<typeof Client>
    ) {
        super(...args);
        this.io = io;
        this.interactionHandler = new InteractionHandler(this);
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
            async (payload): Promise<boolean> =>
                this.music.players.handleVoiceUpdate(payload),
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
}
