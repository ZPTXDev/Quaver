import type { QuaverSong } from '#src/lib/util';
import type { Snowflake } from 'discord.js';

type SearchStateRecord = {
    pages: QuaverSong[][];
    timeout: ReturnType<typeof setTimeout>;
    selected: Snowflake[];
};

export const searchState: Record<Snowflake, SearchStateRecord> = {};
