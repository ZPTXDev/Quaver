import { PlayerResponse } from '#src/lib/PlayerHandler.js';
import type {
    QuaverInteraction,
    QuaverPlayer,
} from '#src/lib/util/common.d.js';
import { MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import {
    getLocaleString,
    getRequesterStatus,
    RequesterStatus,
} from '#src/lib/util/util.js';
import { msToTime, msToTimeString } from '@zptxdev/zptx-lib';
import type {
    ChatInputCommandInteraction,
    GuildMember,
    SlashCommandIntegerOption,
} from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription(
            getLocaleString(settings.defaultLocaleCode, 'CMD.SEEK.DESCRIPTION'),
        )
        .addIntegerOption(
            (option): SlashCommandIntegerOption =>
                option
                    .setName('hours')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.SEEK.OPTION.HOURS',
                        ),
                    )
                    .setMinValue(0)
                    .setMaxValue(23),
        )
        .addIntegerOption(
            (option): SlashCommandIntegerOption =>
                option
                    .setName('minutes')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.SEEK.OPTION.MINUTES',
                        ),
                    )
                    .setMinValue(0)
                    .setMaxValue(59),
        )
        .addIntegerOption(
            (option): SlashCommandIntegerOption =>
                option
                    .setName('seconds')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.SEEK.OPTION.SECONDS',
                        ),
                    )
                    .setMinValue(0)
                    .setMaxValue(59),
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
        const player = interaction.client.music.players.get(
            interaction.guildId,
        ) as QuaverPlayer;
        const hours = interaction.options.getInteger('hours') ?? 0,
            minutes = interaction.options.getInteger('minutes') ?? 0,
            seconds = interaction.options.getInteger('seconds') ?? 0;
        if (
            interaction.options.getInteger('hours') === null &&
            interaction.options.getInteger('minutes') === null &&
            interaction.options.getInteger('seconds') === null
        ) {
            await interaction.replyHandler.locale(
                'CMD.SEEK.RESPONSE.TIMESTAMP_MISSING',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const position = hours * 3600000 + minutes * 60000 + seconds * 1000;
        const requesterStatus = await getRequesterStatus(
            player.queue.current,
            interaction.member as GuildMember,
            player.queue.channel,
        );
        if (requesterStatus === RequesterStatus.NotRequester) {
            await interaction.replyHandler.locale('CHECK.NOT_REQUESTER', {
                type: MessageOptionsBuilderType.Error,
            });
            return;
        }
        const duration = msToTime(player.queue.current.length);
        const durationString = msToTimeString(duration, true);
        const target = msToTime(position);
        const targetString = msToTimeString(target, true);
        const response = await player.handler.seek(position);
        switch (response) {
            case PlayerResponse.PlayerIdle:
                await interaction.replyHandler.locale(
                    'MUSIC.PLAYER.PLAYING.NOTHING',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.PlayerIsStream:
                await interaction.replyHandler.locale(
                    'CMD.SEEK.RESPONSE.STREAM_CANNOT_SEEK',
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.InputOutOfRange:
                await interaction.replyHandler.locale(
                    'CMD.SEEK.RESPONSE.TIMESTAMP_INVALID',
                    {
                        vars: [durationString],
                        type: MessageOptionsBuilderType.Error,
                    },
                );
                return;
            case PlayerResponse.Success:
                await interaction.replyHandler.locale(
                    requesterStatus === RequesterStatus.Requester
                        ? 'CMD.SEEK.RESPONSE.SUCCESS.DEFAULT'
                        : requesterStatus === RequesterStatus.ManagerBypass
                        ? 'CMD.SEEK.RESPONSE.SUCCESS.MANAGER'
                        : 'CMD.SEEK.RESPONSE.SUCCESS.FORCED',
                    {
                        vars: [targetString, durationString],
                    },
                );
        }
    },
};
