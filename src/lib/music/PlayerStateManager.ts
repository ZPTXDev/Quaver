import { logger } from '#src/lib/logger';
import type { PlayerStatesRecord } from '#src/lib/music/types';
import { settings } from '#src/lib/util';
import { readFile, unlink, writeFile } from 'node:fs/promises';

export class PlayerStateManager {
    private readonly filePath = 'states.json';

    async read(): Promise<PlayerStatesRecord> {
        try {
            const raw = await readFile(this.filePath, 'utf8');
            return JSON.parse(raw);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                logger.error(error);
            }
            return {};
        }
    }

    async save(states: PlayerStatesRecord): Promise<void> {
        await this.delete();
        try {
            await writeFile(this.filePath, JSON.stringify(states, null, 4));
        } catch (error) {
            logger.error(error);
        }
    }

    async delete(): Promise<void> {
        try {
            await unlink(this.filePath);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                logger.error(error);
            }
        }
    }

    shouldRestore(states: PlayerStatesRecord): boolean {
        if (
            states.savedAt &&
            Date.now() - states.savedAt >
                (settings.sessionRecovery.maxAge ?? 86400) * 1000
        ) {
            logger.warn(
                'Saved player states are too old and will not be restored.',
            );
            return false;
        }

        if (
            states.attempts &&
            states.attempts >= (settings.sessionRecovery.maxAttempts ?? 1)
        ) {
            logger.warn('Maximum session recovery attempts reached.');
            return false;
        }

        return true;
    }
}
