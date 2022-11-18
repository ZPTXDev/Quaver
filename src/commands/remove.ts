import type { QuaverInteraction } from '#src/lib/util/common.d.js';
import { MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getLocaleString } from '#src/lib/util/util.js';
import type { Song } from '@lavaclient/queue';
import type {
    ChatInputCommandInteraction,
    GuildMember,
    SlashCommandIntegerOption,
} from 'discord.js';
import {
    escapeMarkdown,
    PermissionsBitField,
    SlashCommandBuilder,
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
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
        const { bot, io } = await import('#src/main.js');
        const player = interaction.client.music.players.get(
            interaction.guildId,
        );
        const position = interaction.options.getInteger('position');
        if (player.queue.tracks.length === 0) {
            await interaction.replyHandler.locale(
                'CMD.REMOVE.RESPONSE.QUEUE_EMPTY',
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }
        if (position > player.queue.tracks.length) {
            await interaction.replyHandler.locale('CHECK.INVALID_INDEX', {
                type: MessageOptionsBuilderType.Error,
            });
            return;
        }
        if (
            player.queue.tracks[position - 1].requester !==
                interaction.user.id &&
            interaction.channel
                .permissionsFor(interaction.member as GuildMember)
                .missing(PermissionsBitField.Flags.ManageGuild).length !== 0 &&
            !settings.managers.includes(interaction.user.id)
        ) {
            await interaction.replyHandler.locale('CHECK.NOT_REQUESTER', {
                type: MessageOptionsBuilderType.Error,
            });
            return;
        }
        const track = player.queue.remove(position - 1);
        if (settings.features.web.enabled) {
            io.to(`guild:${interaction.guildId}`).emit(
                'queueUpdate',
                player.queue.tracks.map(
                    (
                        t: Song & { requesterTag: string },
                    ): Song & { requesterTag: string } => {
                        t.requesterTag = bot.users.cache.get(t.requester)?.tag;
                        return t;
                    },
                ),
            );
        }
        await interaction.replyHandler.locale(
            track.requester === interaction.user.id
                ? 'CMD.REMOVE.RESPONSE.SUCCESS.DEFAULT'
                : interaction.channel
                      .permissionsFor(interaction.member as GuildMember)
                      .missing(PermissionsBitField.Flags.ManageGuild).length ===
                  0
                ? 'CMD.REMOVE.RESPONSE.SUCCESS.FORCED'
                : 'CMD.REMOVE.RESPONSE.SUCCESS.MANAGER',
            {
                vars: [escapeMarkdown(track.title), track.uri],
                type: MessageOptionsBuilderType.Success,
            },
        );
    },
};
