import type { Guild } from 'discord.js';
import { data } from '#src/lib/util/common';

export class QuaverGuildSettings {
    guild;

    constructor(guild: Guild) {
        this.guild = guild;
    }

    get<T>(setting: string): Promise<T> {
        return data.guild.get(this.guild.id, `settings.${setting}`);
    }

    set(setting: string, value: string | number | boolean): Promise<boolean> {
        return data.guild.set(this.guild.id, `settings.${setting}`, value);
    }

    unset(setting: string): Promise<boolean> {
        return data.guild.unset(this.guild.id, `settings.${setting}`);
    }
}
