import type { Guild } from 'discord.js';
import { QuaverGuildBuilders, QuaverGuildFeatures, QuaverGuildSettings, type QuaverPlayer } from '.';
import type { QuaverClient } from './util/common.d.js';
import { settings } from './util/settings.js';
import { getLocaleString } from './util/util.js';

type Uninitialized = { localeCode: undefined };
export type Initialized = { localeCode: string };

export class QuaverGuild<S extends Uninitialized | Initialized> {
    builders!: QuaverGuildBuilders;
    features!: QuaverGuildFeatures;
    settings!: QuaverGuildSettings;
    localeCode: S['localeCode'];
    client: QuaverClient;

    private constructor(private guild: Guild) {
        this.localeCode = undefined as S['localeCode'];
        this.client = guild.client as QuaverClient;
    }

    private async init(): Promise<void> {
        this.settings = new QuaverGuildSettings(this.guild);
        this.localeCode =
            (await this.settings.get<string>('locale')) ??
            settings.defaultLocaleCode;
        this.builders = new QuaverGuildBuilders(this);
        this.features = new QuaverGuildFeatures(this.guild);
    }

    sendWebUpdate(event: string, ...args: unknown[]): void {
        if (!settings.features.web.enabled) return;
        this.client.io.to(`guild:${this.guild.id}`).emit(event, ...args);
    }

    getPlayer(): Promise<QuaverPlayer> {
        return this.client.music.players.fetch(this.guild.id);
    }

    locale(
        this: QuaverGuild<Initialized>,
        key: string,
        ...args: string[]
    ): string {
        return getLocaleString(this.localeCode, key, ...args);
    }

    static async wrap(
        guild: Guild & { client: QuaverClient },
    ): Promise<QuaverGuild<Initialized> & Guild> {
        if (!guild) {
            throw new Error(
                'Guild is required and cannot be null or undefined',
            );
        }
        const instance = new QuaverGuild(guild);
        await instance.init();
        return new Proxy(instance as QuaverGuild<Initialized>, {
            get(target, prop, receiver): unknown {
                if (prop in target) return Reflect.get(target, prop, receiver);
                return Reflect.get(guild, prop, receiver);
            },
        }) as QuaverGuild<Initialized> & Guild;
    }
}
