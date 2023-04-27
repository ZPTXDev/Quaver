import type { QuaverClient } from '#src/lib/util/common.d.js';
import { logger } from '#src/lib/util/common.js';
import { settings } from '#src/lib/util/settings.js';
import { version } from '#src/lib/util/version.js';
import type { PresenceStatusData } from 'discord.js';
import { ActivityType } from 'discord.js';

export default {
    name: 'ready',
    once: true,
    async execute(client: QuaverClient): Promise<void> {
        const { startup } = await import('#src/main.js');
        startup.started = true;
        logger.info({
            message: `Connected. Logged in as ${client.user.tag}.`,
            label: 'Discord',
        });
        logger.info({
            message: `Running version ${version}. For help, see https://github.com/ZPTXDev/Quaver/issues.`,
            label: 'Quaver',
        });
        if (version.includes('-')) {
            logger.warn({
                message:
                    'You are running an unstable version of Quaver. Please report bugs using the link above, and note that features may change or be removed entirely prior to release.',
                label: 'Quaver',
            });
        }
        if (settings.developerMode) {
            logger.warn({
                message:
                    'Developer mode is enabled. This should not be enabled unless you know what you are doing.',
                label: 'Quaver',
            });
            logger.warn({
                message:
                    'If someone is requesting information obtained through developer mode, they are likely trying to steal your credentials.',
                label: 'Quaver',
            });
            logger.warn({
                message:
                    'We are not responsible for damages caused by negligent use of developer mode.',
                label: 'Quaver',
            });
        }
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
        client.music.connect(client.user.id);
        await client.application.commands.fetch();
    },
};
