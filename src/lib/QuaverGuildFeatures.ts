import type { Guild } from 'discord.js';
import type { Initialized, QuaverGuild } from '.';
import { data } from './util/common';
import { settings } from './util/settings';

export type WhitelistedFeatures = 'stay' | 'autolyrics' | 'smartqueue';

export enum WhitelistStatus {
    /**
     * The guild is not whitelisted
     */
    NotWhitelisted,
    /**
     * The whitelist has expired
     */
    Expired,
    /**
     * The whitelist is temporary
     */
    Temporary,
    /**
     * The whitelist is permanent
     */
    Permanent,
}

export class QuaverGuildFeatures {
    guild;

    constructor(guild: QuaverGuild<Initialized> & Guild) {
        this.guild = guild;
    }

    get<T>(feature: string): Promise<T> {
        return data.guild.get(this.guild.id, `features.${feature}`);
    }

    set(feature: string, value: string | number | boolean): Promise<boolean> {
        return data.guild.set(this.guild.id, `features.${feature}`, value);
    }

    unset(feature: string): Promise<boolean> {
        return data.guild.unset(this.guild.id, `features.${feature}`);
    }

    async checkWhitelisted(
        feature: WhitelistedFeatures,
    ): Promise<WhitelistStatus> {
        if (!settings.features[feature].whitelist) {
            return WhitelistStatus.Permanent;
        }
        const whitelisted = await this.get<number>(`${feature}.whitelisted`);
        if (!whitelisted) return WhitelistStatus.NotWhitelisted;
        if (whitelisted !== -1 && Date.now() > whitelisted) {
            return WhitelistStatus.Expired;
        }
        if (whitelisted === -1) return WhitelistStatus.Permanent;
        return WhitelistStatus.Temporary;
    }
}
