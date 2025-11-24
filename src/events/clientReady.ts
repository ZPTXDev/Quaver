import { ActivityType, type PresenceStatusData } from 'discord.js';
import type { QuaverClient } from '#src/lib';
import { EventHandler } from '#src/lib/builders';
import { logger } from '#src/lib/util/common';
import { settings } from '#src/lib/util/settings';
import { version } from '#src/lib/util/version';

export default new EventHandler()
    .setOnce(true)
    .setEvent('clientReady')
    .setExecute(async function (client): Promise<void> {
        const { startup } = await import('#src/main');
        startup.started = true;
        logger.info({
            message: `Connected. Logged in as ${client.user.tag}.`,
            label: 'Discord',
        });
        logger.info({
            message: `Running version ${version.version}${version.buildTime ? ` (${new Date(version.buildTime).toLocaleString()})` : ''}, started in ${Date.now() - startup.startTime}ms. For help, see https://github.com/ZPTXDev/Quaver/issues.`,
            label: 'Quaver',
        });
        if (
            version.version.includes('-next') ||
            version.version.includes('-staging')
        ) {
            logger.warn({
                message: `You are running ${version.version.includes('-next') ? 'an experimental' : 'a pre-release'} version of Quaver. Please report bugs using the link above, and note that features may change or be removed entirely prior to release.`,
                label: 'Quaver',
            });
        }
        if (!version.official) {
            logger.warn({
                message:
                    'You are not running an official build of Quaver. For support, please switch to an official version from https://github.com/ZPTXDev/Quaver/releases.',
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
        (client as QuaverClient).music.connect({ userId: client.user.id });
        await client.application.commands.fetch();
    });
