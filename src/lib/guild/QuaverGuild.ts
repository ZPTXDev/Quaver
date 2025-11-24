import type { Guild } from 'discord.js';
import { GuildBuilders, GuildFeatures, GuildSettings } from '.';
import type { QuaverClient } from '#src/lib';
import type { QuaverPlayer } from '#src/lib/music';
import type { LocaleKey } from '#src/lib/util/LocaleKeys';
import { settings } from '#src/lib/util/settings';
import { getLocaleString } from '#src/lib/util/util';

export type Initialized = { localeCode: string };
export type Uninitialized = { localeCode: undefined };

export class QuaverGuild<S extends Uninitialized | Initialized> {
    builders!: GuildBuilders;
    features!: GuildFeatures;
    settings!: GuildSettings;
    localeCode: S['localeCode'];
    client: QuaverClient;

    private constructor(private guild: Guild) {
        this.localeCode = undefined as S['localeCode'];
        this.client = guild.client as QuaverClient;
    }

    private async init(): Promise<void> {
        this.settings = new GuildSettings(this.guild);
        this.localeCode =
            (await this.settings.get<string>('locale')) ??
            settings.defaultLocaleCode;
        this.builders = new GuildBuilders(this);
        this.features = new GuildFeatures(this.guild);
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
        key: LocaleKey,
        ...args: string[]
    ): string {
        return getLocaleString(this.localeCode, key, ...args);
    }

    static async wrap(guild: Guild): Promise<QuaverGuild<Initialized> & Guild> {
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
