import { buildNowPlayingMessage } from '#src/events/music/trackStart';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { PlayerResponse } from '#src/lib/music';
import { Check, settings } from '#src/lib/util';
import { LoopType } from '@lavaclient/plugin-queue';
import { SlashCommandBuilder, type SlashCommandStringOption } from 'discord.js';

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('loop')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.LOOP.DESCRIPTION',
                ),
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
    )
    .setChecks([
        Check.GuildOnly,
        Check.ActiveSession,
        Check.InVoice,
        Check.InSessionVoice,
    ])
    .setExecute(async function (interaction): Promise<void> {
        const type = interaction.options.getString('type');
        const guild = await QuaverGuild.wrap(interaction.guild);
        const player = await guild.getPlayer();
        let loop, typeLocale;
        switch (type) {
            case 'disabled':
                loop = LoopType.None;
                typeLocale = guild.locale(
                    'CMD.LOOP.OPTION.TYPE.OPTION.DISABLED',
                );
                break;
            case 'track':
                loop = LoopType.Song;
                typeLocale = guild.locale('CMD.LOOP.OPTION.TYPE.OPTION.TRACK');
                break;
            case 'queue':
                loop = LoopType.Queue;
                typeLocale = guild.locale('CMD.LOOP.OPTION.TYPE.OPTION.QUEUE');
                break;
        }
        typeLocale = typeLocale.toLowerCase();
        const response = await player.setLoopMode(loop, interaction.user);
        if (response !== PlayerResponse.Success) return;
        await interaction.replyHandler.reply(
            guild.locale('CMD.LOOP.RESPONSE.SUCCESS', typeLocale),
        );

        // Update the now playing message if it exists and controls are enabled
        const format = (await guild.settings.get<string>('format')) ?? 'simple';
        const controls = (await guild.settings.get<boolean>('controls')) ?? true;
        if (format === 'detailed' && controls && player.memory.currentNowPlayingMessageId && player.queue.current) {
            try {
                const channel = player.queue.channel;
                if (channel) {
                    const message = await channel.messages.fetch(player.memory.currentNowPlayingMessageId);
                    const showArtist = (await guild.settings.get<boolean>('showartist')) ?? true;
                    const { container, actionRows } = await buildNowPlayingMessage(guild, player.queue.current, showArtist);
                    await message.edit(container.addActionRowComponents(...actionRows).toMessageCreateOptions());
                }
            } catch {
                // Message might have been deleted, ignore
            }
        }
    });
