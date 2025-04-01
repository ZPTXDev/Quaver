import { PlayerResponse } from '#src/lib/PlayerHandler.js';
import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getGuildLocaleString, getLocaleString } from '#src/lib/util/util.js';
import { LoopType } from '@lavaclient/plugin-queue';
import type {
    ChatInputCommandInteraction,
    SlashCommandStringOption,
} from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription(
            getLocaleString(settings.defaultLocaleCode, 'CMD.LOOP.DESCRIPTION'),
        )
        .addStringOption(
            (option): SlashCommandStringOption =>
                option
                    .setName('type')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.LOOP.OPTION.TYPE.DESCRIPTION',
                        ),
                    )
                    .setRequired(true)
                    .addChoices(
                        {
                            name: getLocaleString(
                                settings.defaultLocaleCode,
                                'CMD.LOOP.OPTION.TYPE.OPTION.DISABLED',
                            ),
                            value: 'disabled',
                        },
                        {
                            name: getLocaleString(
                                settings.defaultLocaleCode,
                                'CMD.LOOP.OPTION.TYPE.OPTION.TRACK',
                            ),
                            value: 'track',
                        },
                        {
                            name: getLocaleString(
                                settings.defaultLocaleCode,
                                'CMD.LOOP.OPTION.TYPE.OPTION.QUEUE',
                            ),
                            value: 'queue',
                        },
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
        const player = (await interaction.client.music.players.fetch(
            interaction.guildId,
        )) as QuaverPlayer;
        const type = interaction.options.getString('type');
        let loop, typeLocale;
        switch (type) {
            case 'disabled':
                loop = LoopType.None;
                typeLocale = await getGuildLocaleString(
                    interaction.guildId,
                    'CMD.LOOP.OPTION.TYPE.OPTION.DISABLED',
                );
                break;
            case 'track':
                loop = LoopType.Song;
                typeLocale = await getGuildLocaleString(
                    interaction.guildId,
                    'CMD.LOOP.OPTION.TYPE.OPTION.TRACK',
                );
                break;
            case 'queue':
                loop = LoopType.Queue;
                typeLocale = await getGuildLocaleString(
                    interaction.guildId,
                    'CMD.LOOP.OPTION.TYPE.OPTION.QUEUE',
                );
                break;
        }
        typeLocale = typeLocale.toLowerCase();
        const response = await player.handler.loop(loop);
        if (response !== PlayerResponse.Success) return;
        await interaction.replyHandler.locale('CMD.LOOP.RESPONSE.SUCCESS', {
            vars: [typeLocale],
        });
    },
};
