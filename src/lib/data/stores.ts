import { settings } from '#src/lib/util';
import { createCache } from 'cache-manager';
import { KeyvCacheableMemory } from 'cacheable';
import Keyv from 'keyv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataHandler } from '.';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const data = {
    guild: new DataHandler({
        cache: settings.database
            ? `${settings.database.protocol}://${resolve(
                  __dirname,
                  '..',
                  '..',
                  settings.database.path,
              )}`
            : `sqlite://${resolve(__dirname, '..', '..', 'database.sqlite')}`,
        namespace: 'guild',
    }),
};

export const cache = createCache({
    stores: [new Keyv({ store: new KeyvCacheableMemory({ ttl: '10m' }) })],
});
