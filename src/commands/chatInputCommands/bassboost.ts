import { PlayerResponse } from '#src/lib/PlayerHandler.js';
import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getLocaleString } from '#src/lib/util/util.js';
import type {
    ChatInputCommandInteraction,
    SlashCommandBooleanOption,
} from 'discord.js';
import {
    ContainerBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import { data } from '#src/lib/util/common.js';

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
        const player = (await interaction.client.music.players.fetch(
            interaction.guildId,
        )) as QuaverPlayer;
        const response = await player.handler.bassboost(
            enabled !== null ? enabled : !player.bassboost,
        );
        if (response !== PlayerResponse.Success) return;
        const guildLocaleCode =
            (await data.guild.get<string>(
                interaction.guildId,
                'settings.locale',
            )) ?? settings.defaultLocaleCode;
        await interaction.replyHandler.reply(
            new ContainerBuilder({
                components: [
                    new TextDisplayBuilder()
                        .setContent(
                            getLocaleString(
                                guildLocaleCode,
                                player.bassboost
                                    ? 'CMD.BASSBOOST.RESPONSE.ENABLED'
                                    : 'CMD.BASSBOOST.RESPONSE.DISABLED',
                            ),
                        )
                        .toJSON(),
                    new TextDisplayBuilder()
                        .setContent(
                            getLocaleString(
                                guildLocaleCode,
                                'MUSIC.PLAYER.FILTER_NOTE',
                            ),
                        )
                        .toJSON(),
                ],
            }),
        );
    },
};
