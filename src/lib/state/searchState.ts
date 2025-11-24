import type { Song } from '@lavaclient/plugin-queue';
import type { Snowflake } from 'discord.js';

type SearchStateRecord = {
    pages: Song[][];
    timeout: ReturnType<typeof setTimeout>;
    selected: Snowflake[];
};

export const searchState: Record<Snowflake, SearchStateRecord> = {};
