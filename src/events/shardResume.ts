import { logger } from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import { version } from '#src/lib/util/version.js';
import type { PresenceStatusData } from 'discord.js';
import { ActivityType } from 'discord.js';

export default {
    name: 'shardResume',
    once: false,
    async execute(): Promise<void> {
        const { bot } = await import('#src/main.js');
        let activityType:
            | ActivityType.Playing
            | ActivityType.Streaming
            | ActivityType.Listening
            | ActivityType.Watching
            | ActivityType.Competing;
        switch (settings.status.activityType.toLowerCase()) {
            case 'streaming':
                activityType = ActivityType.Streaming;
                break;
            case 'listening':
                activityType = ActivityType.Listening;
                break;
            case 'watching':
                activityType = ActivityType.Watching;
                break;
            case 'competing':
                activityType = ActivityType.Competing;
                break;
            default:
                activityType = ActivityType.Playing;
                break;
        }
        let presence: PresenceStatusData = 'online';
        if (
            ['online', 'idle', 'dnd', 'invisible'].includes(
                settings.status.presence.toLowerCase(),
            )
        ) {
            presence =
                settings.status.presence.toLowerCase() as PresenceStatusData;
        }
        bot.user.setPresence({
            status: presence,
            activities: [
                {
                    name: `${settings.status.name}${
                        settings.status.showVersion ? ` | ${version}` : ''
                    }`,
                    type: activityType,
                    url:
                        settings.status.url === ''
                            ? undefined
                            : settings.status.url,
                },
            ],
        });
        logger.info({ message: 'Reconnected.', label: 'Discord' });
    },
};
