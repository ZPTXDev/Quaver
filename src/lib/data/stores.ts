import type { Cache } from 'cache-manager';
import type { DataHandler } from '.';

export const data: {
    guild: DataHandler;
    cache: Cache;
} = {
    guild: null,
    cache: null,
};
