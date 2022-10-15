import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getLocaleString } from '#src/lib/util/util.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription(
            getLocaleString(
                settings.defaultLocaleCode,
                'CMD.RESUME.DESCRIPTION',
            ),
        ),
    checks: [
        checks.GUILD_ONLY,
        checks.ACTIVE_SESSION,
        checks.IN_VOICE,
        checks.IN_SESSION_VOICE,
    ],
    permissions: {
        user: [],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
        const { io } = await import('#src/main.js');
        const player = interaction.client.music.players.get(
            interaction.guildId,
        );
        if (!player.paused) {
            await interaction.replyHandler.locale(
                'CMD.RESUME.RESPONSE.STATE_UNCHANGED',
                { type: 'error' },
            );
            return;
        }
        await player.resume();
        if (!player.playing && player.queue.tracks.length > 0) {
            await player.queue.start();
        }
        if (settings.features.web.enabled) {
            io.to(`guild:${interaction.guildId}`).emit(
                'pauseUpdate',
                player.paused,
            );
        }
        await interaction.replyHandler.locale('CMD.RESUME.RESPONSE.SUCCESS', {
            type: 'success',
        });
    },
};
