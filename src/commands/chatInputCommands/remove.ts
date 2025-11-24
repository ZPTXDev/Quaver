import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { PlayerResponse } from '#src/lib/music';
import {
    Check,
    getRequesterStatus,
    getTrackMarkdownLocaleString,
    RequesterStatus,
    settings,
} from '#src/lib/util';
import {
    type GuildMember,
    SlashCommandBuilder,
    type SlashCommandIntegerOption,
} from 'discord.js';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('remove')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.REMOVE.DESCRIPTION',
                ),
            )
            .addIntegerOption(
                (option): SlashCommandIntegerOption =>
                    option
                        .setName('position')
                        .setDescription(
                            getLocaleString(
                                settings.defaultLocaleCode,
                                'CMD.REMOVE.OPTION.POSITION',
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
    .setExecute(async function (interaction): Promise<void> {
        const position = interaction.options.getInteger('position');
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        const track = player.queue.tracks[position - 1];
        // workaround: if track doesn't exist, temporarily mark it as "requested by user" and we'll let the switch case deal with it
        // FIXME: should turn QuaverSong into a proper class so this method can be called directly on it
        const requesterStatus = track
            ? await getRequesterStatus(
                  track,
                  interaction.member as GuildMember,
                  player.queue.channel,
              )
            : RequesterStatus.Requester;
        if (requesterStatus === RequesterStatus.NotRequester) {
            await interaction.replyHandler.reply(
                guild.locale('CHECK.NOT_REQUESTER'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        const response = await player.removeQueuedTrack(position);
        switch (response) {
            case PlayerResponse.QueueInsufficientTracks:
                await interaction.replyHandler.reply(
                    guild.locale('CMD.REMOVE.RESPONSE.QUEUE_EMPTY'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.InputOutOfRange:
                await interaction.replyHandler.reply(
                    guild.locale('CHECK.INVALID_INDEX'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            default: {
                await interaction.replyHandler.reply(
                    guild.locale(
                        requesterStatus === RequesterStatus.Requester
                            ? 'CMD.REMOVE.RESPONSE.SUCCESS.DEFAULT'
                            : requesterStatus === RequesterStatus.ManagerBypass
                              ? 'CMD.REMOVE.RESPONSE.SUCCESS.MANAGER'
                              : 'CMD.REMOVE.RESPONSE.SUCCESS.FORCED',
                        getTrackMarkdownLocaleString(track),
                    ),
                    { type: MessageOptionsBuilderType.Success },
                );
            }
        }
    });
