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
    getTrackMarkdownLocaleString,
    RequesterStatus,
} from '#src/lib/util/util';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('skipto')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.SKIPTO.DESCRIPTION',
                ),
            )
            .addIntegerOption(
                (option): SlashCommandIntegerOption =>
                    option
                        .setName('position')
                        .setDescription(
                            getLocaleString(
                                settings.defaultLocaleCode,
                                'CMD.SKIPTO.OPTION.POSITION',
                            ),
                        )
                        .setMinValue(1)
                        .setRequired(true)
                        .setAutocomplete(true),
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
        const position = interaction.options.getInteger('position');
        if (!player.queue.current || (!player.playing && !player.paused)) {
            await interaction.replyHandler.reply(
                guild.locale('MUSIC.PLAYER.PLAYING.NOTHING'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const track = player.queue.current;
        const requesterStatus = await getRequesterStatus(
            track,
            interaction.member as GuildMember,
            player.queue.channel,
        );
        if (requesterStatus === RequesterStatus.NotRequester) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.SKIPTO.RESPONSE.NOT_REQUESTER'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const response = await player.skipToQueuedTrack(position);
        switch (response) {
            case PlayerResponse.PlayerIdle:
                await interaction.replyHandler.reply(
                    guild.locale('MUSIC.PLAYER.PLAYING.NOTHING'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.InputOutOfRange:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.SKIPTO.RESPONSE.OUT_OF_RANGE'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.Success: {
                const movedTrack = player.queue.current;
                await interaction.replyHandler.reply(
                    guild.locale(
                        requesterStatus === RequesterStatus.Requester
                            ? 'CMD.SKIPTO.RESPONSE.SUCCESS.DEFAULT'
                            : requesterStatus === RequesterStatus.ManagerBypass
                              ? 'CMD.SKIPTO.RESPONSE.SUCCESS.MANAGER'
                              : 'CMD.SKIPTO.RESPONSE.SUCCESS.FORCED',
                        getTrackMarkdownLocaleString(track),
                        getTrackMarkdownLocaleString(movedTrack),
                    ),
                );
            }
        }
    });
