import {
    ContainerBuilder,
    SlashCommandBuilder,
    type SlashCommandIntegerOption,
} from 'discord.js';
import { PlayerResponse, QuaverGuild } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { MessageOptionsBuilderType } from '#src/lib/util/common';
import { Check } from '#src/lib/util/constants';
import { settings } from '#src/lib/util/settings';
import { getLocaleString } from '#src/lib/util/util';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('volume')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.VOLUME.DESCRIPTION',
                ),
            )
            .addIntegerOption(
                (option): SlashCommandIntegerOption =>
                    option
                        .setName('new_volume')
                        .setDescription(
                            getLocaleString(
                                settings.defaultLocaleCode,
                                'CMD.VOLUME.OPTION.NEW_VOLUME',
                            ),
                        )
                        .setMinValue(0)
                        .setMaxValue(200)
                        .setRequired(true),
            ),
    )
    .setChecks([
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ])
    .setExecute(async function(interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        const volume = interaction.options.getInteger('new_volume');
        if (volume > 200) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.VOLUME.RESPONSE.OUT_OF_RANGE'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const response = await player.setVolumeTo(volume);
        if (response !== PlayerResponse.Success) return;
        await interaction.replyHandler.reply(
            new ContainerBuilder().addTextDisplayComponents(
                guild.builders.textDisplayLocale(
                    'CMD.VOLUME.RESPONSE.SUCCESS',
                    volume.toString(),
                ),
                guild.builders.textDisplayLocale('MUSIC.PLAYER.FILTER_NOTE'),
            ),
        );
    });
