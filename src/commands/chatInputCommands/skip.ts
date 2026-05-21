import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { PlayerResponse } from '#src/lib/music';
import {
    Check,
    getPremiumURL,
    getRequesterStatus,
    getTrackMarkdownLocaleString,
    RequesterStatus,
    settings,
} from '#src/lib/util';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, type GuildMember, SlashCommandBuilder } from 'discord.js';


export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('skip')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.SKIP.DESCRIPTION',
                ),
            ),
    )
    .setChecks([
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ])
    .setExecute(async function (interaction): Promise<void> {
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        
        // Check if an ad is playing
        if (player.memory.isAdPlaying) {
            const premiumURL = getPremiumURL(interaction.guild.id);
            
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    guild.builders.textDisplayLocale('CMD.SKIP.RESPONSE.ERROR.AD_PLAYING'),
                );
            
            if (premiumURL) {
                container.addActionRowComponents(
                    new ActionRowBuilder<ButtonBuilder>().setComponents(
                        new ButtonBuilder()
                            .setLabel('Get Premium')
                            .setStyle(ButtonStyle.Link)
                            .setURL(premiumURL),
                    ),
                );
            }
            
            await interaction.replyHandler.reply(container, {
                type: MessageOptionsBuilderType.Error,
            });
            return;
        }
        
        // this check already occurs in the PlayerHandler#skip() method, but we do it first as we need to check before running voteskip addition etc
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
            const skip = player.memory.skip ?? {
                required: Math.ceil(
                    (
                        interaction.member as GuildMember
                    ).voice.channel.members.filter((m): boolean => !m.user.bot)
                        .size / 2,
                ),
                users: [],
            };
            if (skip.users.includes(interaction.user.id)) {
                await interaction.replyHandler.reply(
                    guild.locale('CMD.SKIP.RESPONSE.VOTED.STATE_UNCHANGED'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }
            skip.users.push(interaction.user.id);
            if (skip.users.length >= skip.required) {
                const response = await player.skipCurrentTrack();
                switch (response) {
                    case PlayerResponse.PlayerIdle:
                        await interaction.replyHandler.reply(
                            guild.locale('MUSIC.PLAYER.PLAYING.NOTHING'),
                            { type: MessageOptionsBuilderType.Error },
                        );
                        return;
                    case PlayerResponse.Success: {
                        await interaction.replyHandler.reply(
                            `${guild.locale(
                                'CMD.SKIP.RESPONSE.SUCCESS.VOTED',
                                getTrackMarkdownLocaleString(track),
                            )}\n${guild.locale(
                                'MISC.ADDED_BY',
                                track.requesterId,
                            )}`,
                        );
                    }
                }
                return;
            }
            player.memory.skip = skip;
            await interaction.replyHandler.reply(
                guild.locale(
                    'CMD.SKIP.RESPONSE.VOTED.SUCCESS',
                    getTrackMarkdownLocaleString(track),
                    skip.users.length.toString(),
                    skip.required.toString(),
                ),
                { type: MessageOptionsBuilderType.Success },
            );
            return;
        }
        const response = await player.skipCurrentTrack();
        switch (response) {
            case PlayerResponse.RestartInProgress:
                await interaction.replyHandler.reply(
                    guild.locale('MUSIC.PLAYER.RESTARTING.ACTION_BLOCKED'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.PlayerIdle:
                await interaction.replyHandler.reply(
                    guild.locale('MUSIC.PLAYER.PLAYING.NOTHING'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            case PlayerResponse.Success: {
                await interaction.replyHandler.reply(
                    `${guild.locale(
                        requesterStatus === RequesterStatus.Requester
                            ? 'CMD.SKIP.RESPONSE.SUCCESS.DEFAULT'
                            : requesterStatus === RequesterStatus.ManagerBypass
                              ? 'CMD.SKIP.RESPONSE.SUCCESS.MANAGER'
                              : 'CMD.SKIP.RESPONSE.SUCCESS.FORCED',
                        getTrackMarkdownLocaleString(track),
                    )}${
                        requesterStatus !== RequesterStatus.Requester
                            ? `\n${guild.locale(
                                  'MISC.ADDED_BY',
                                  track.requesterId,
                              )}`
                            : ''
                    }`,
                );
            }
        }
    });
