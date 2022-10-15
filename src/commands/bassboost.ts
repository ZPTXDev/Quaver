import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { checks } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import type {
    ChatInputCommandInteraction,
    SlashCommandBooleanOption,
} from 'discord.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('bassboost')
        .setDescription(
            getLocaleString(
                settings.defaultLocaleCode,
                'CMD.BASSBOOST.DESCRIPTION',
            ),
        )
        .addBooleanOption(
            (option): SlashCommandBooleanOption =>
                option
                    .setName('enabled')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.BASSBOOST.OPTION.ENABLED',
                        ),
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
        ) as QuaverPlayer;
        const enabled = interaction.options.getBoolean('enabled');
        const boost = enabled !== null ? enabled : !player.bassboost;
        let eqValues: number[] = new Array(15).fill(0);
        if (boost) {
            eqValues = [
                0.2,
                0.15,
                0.1,
                0.05,
                0.0,
                ...new Array(10).fill(-0.05),
            ];
        }
        await player.setEqualizer(...eqValues);
        player.bassboost = boost;
        if (settings.features.web.enabled) {
            io.to(`guild:${interaction.guildId}`).emit('filterUpdate', {
                bassboost: player.bassboost,
                nightcore: player.nightcore,
            });
        }
        await interaction.replyHandler.reply(
            new EmbedBuilder()
                .setDescription(
                    await getGuildLocaleString(
                        interaction.guildId,
                        player.bassboost
                            ? 'CMD.BASSBOOST.RESPONSE.ENABLED'
                            : 'CMD.BASSBOOST.RESPONSE.DISABLED',
                    ),
                )
                .setFooter({
                    text: await getGuildLocaleString(
                        interaction.guildId,
                        'MUSIC.PLAYER.FILTER_NOTE',
                    ),
                }),
        );
    },
};
