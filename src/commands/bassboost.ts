import { PlayerResponse } from '#src/lib/PlayerHandler.js';
import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { Check } from '#src/lib/util/constants.js';
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
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ],
    permissions: {
        user: [],
        bot: [],
    },
    async execute(
        interaction: QuaverInteraction<ChatInputCommandInteraction>,
    ): Promise<void> {
        const enabled = interaction.options.getBoolean('enabled');
        const player = interaction.client.music.players.get(
            interaction.guildId,
        ) as QuaverPlayer;
        const response = await player.handler.bassboost(
            enabled !== null ? enabled : !player.bassboost,
        );
        if (response !== PlayerResponse.Success) return;
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
