import { msToTime, msToTimeString } from '@zptxdev/zptx-lib';
import {
    type GuildMember,
    SlashCommandBuilder,
    type SlashCommandIntegerOption,
} from 'discord.js';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { PlayerResponse } from '#src/lib/music';
import { MessageOptionsBuilderType } from '#src/lib/util/common';
import { Check } from '#src/lib/util/constants';
import { settings } from '#src/lib/util/settings';
import {
    getLocaleString,
    getRequesterStatus,
    RequesterStatus,
} from '#src/lib/util/util';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('seek')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.SEEK.DESCRIPTION',
                ),
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
    )
    .setChecks([
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ])
    .setExecute(async function(interaction): Promise<void> {
        const hours = interaction.options.getInteger('hours') ?? 0,
            minutes = interaction.options.getInteger('minutes') ?? 0,
            seconds = interaction.options.getInteger('seconds') ?? 0;
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        if (
            interaction.options.getInteger('hours') === null &&
            interaction.options.getInteger('minutes') === null &&
            interaction.options.getInteger('seconds') === null
        ) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.SEEK.RESPONSE.TIMESTAMP_MISSING'),
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
            await interaction.replyHandler.reply(
                guild.locale('CHECK.NOT_REQUESTER'),
                {
                    type: MessageOptionsBuilderType.Error,
                },
            );
            return;
        }
        const duration = msToTime(player.queue.current.info.length);
        let durationString = msToTimeString(duration, true);
        if (durationString === 'MORE_THAN_A_DAY') {
            durationString = guild.locale('MISC.MORE_THAN_A_DAY');
        }
        const target = msToTime(position);
        let targetString = msToTimeString(target, true);
        if (targetString === 'MORE_THAN_A_DAY') {
            targetString = guild.locale('MISC.MORE_THAN_A_DAY');
        }
        const response = await player.seekTo(position);
        switch (response) {
            case PlayerResponse.PlayerIdle:
                await interaction.replyHandler.reply(
                    guild.locale('MUSIC.PLAYER.PLAYING.NOTHING'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.PlayerIsStream:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.SEEK.RESPONSE.STREAM_CANNOT_SEEK'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.InputOutOfRange:
                await interaction.replyHandler.reply(
                    guild.locale(
                        'CMD.SEEK.RESPONSE.TIMESTAMP_INVALID',
                        durationString,
                    ),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.Success:
                await interaction.replyHandler.reply(
                    guild.locale(
                        requesterStatus === RequesterStatus.Requester
                            ? 'CMD.SEEK.RESPONSE.SUCCESS.DEFAULT'
                            : requesterStatus === RequesterStatus.ManagerBypass
                              ? 'CMD.SEEK.RESPONSE.SUCCESS.MANAGER'
                              : 'CMD.SEEK.RESPONSE.SUCCESS.FORCED',
                        targetString,
                        durationString,
                    ),
                );
        }
    });
