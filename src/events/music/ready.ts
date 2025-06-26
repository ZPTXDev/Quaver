import { data, logger } from '#src/lib/util/common.js';
import type {
    QuaverChannels,
    QuaverClient,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { get } from 'lodash-es';
import PlayerHandler from '#src/lib/PlayerHandler.js';

export default {
    name: 'connected',
    once: false,
    async execute(): Promise<void> {
        const { bot } = await import('#src/main.js');
        logger.info({ message: 'Ready.', label: 'Lavalink' });
        if (!bot.music.ws.session) {
            logger.warn({
                message:
                    'Waiting 5 seconds before re-triggering ready event for Lavalink WS session...',
                label: 'Quaver',
            });
            setTimeout((): void => {
                this.execute();
            }, 5_000);
            return;
        }
        for await (const [
            guildId,
            guildData,
        ] of data.guild.instance.iterator()) {
            if (get(guildData, 'settings.stay.enabled')) {
                const guild = bot.guilds.cache.get(guildId);
                if (!guild) continue;
                const player = bot.music.players.create(
                    guildId,
                ) as QuaverPlayer;
                player.handler = new PlayerHandler(bot as QuaverClient, player);
                player.queue.channel = guild.channels.cache.get(
                    get(guildData, 'settings.stay.text'),
                ) as QuaverChannels;
                player.voice.connect(get(guildData, 'settings.stay.channel'), {
                    deafened: true,
                });
            }
        }
    },
};
