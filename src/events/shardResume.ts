import { ActivityType, type PresenceStatusData } from 'discord.js';
import { EventHandler } from '#src/lib/builders';
import { logger } from '#src/lib/util/common';
import { settings } from '#src/lib/util/settings';
import { version } from '#src/lib/util/version';

export default new EventHandler()
    .setEvent('shardResume')
    .setExecute(async function(): Promise<void> {
        const { client } = await import('#src/main');
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
        client.user.setPresence({
            status: presence,
            activities: [
                {
                    name: `${settings.status.name}${
                        settings.status.showVersion
                            ? ` | ${version.version}`
                            : ''
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
    });
