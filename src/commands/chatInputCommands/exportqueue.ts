import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { Check, settings, version } from '#src/lib/util';
import type { Song } from '@lavaclient/plugin-queue';
import {
    AttachmentBuilder,
    ContainerBuilder,
    FileBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
} from 'discord.js';

interface ExportedTrack {
    encoded: string;
    title: string;
    author: string;
}

interface ExportedQueue {
    version: string;
    exportedAt: string;
    tracks: ExportedTrack[];
}

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('exportqueue')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.EXPORTQUEUE.DESCRIPTION',
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

        // Check if there's anything to export (current track or queue)
        const hasCurrentTrack = player.queue.current && (player.playing || player.paused);
        const hasQueuedTracks = player.queue.tracks.length > 0;

        if (!hasCurrentTrack && !hasQueuedTracks) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.EXPORTQUEUE.RESPONSE.QUEUE_EMPTY'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }

        // Collect all tracks to export (current + queued)
        const tracksToExport: Song[] = [];

        // Add current track first if it exists
        if (hasCurrentTrack) {
            tracksToExport.push(player.queue.current);
        }

        // Add queued tracks
        tracksToExport.push(...player.queue.tracks);

        // Create the export data
        const exportData: ExportedQueue = {
            version: version.version,
            exportedAt: new Date().toISOString(),
            tracks: tracksToExport.map((track: Song): ExportedTrack => ({
                encoded: track.encoded,
                title: track.info.title,
                author: track.info.author,
            })),
        };

        // Create the JSON file
        const fileName = `quaver-queue-${Date.now()}.json`;
        const jsonContent = JSON.stringify(exportData, null, 2);
        const attachment = new AttachmentBuilder(Buffer.from(jsonContent, 'utf-8'), {
            name: fileName,
        });

        // Send the file using components v2 with FileBuilder
        await interaction.replyHandler.reply(
            new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        guild.locale(
                            'CMD.EXPORTQUEUE.RESPONSE.SUCCESS',
                            tracksToExport.length.toString(),
                        ),
                    ),
                )
                .addFileComponents(new FileBuilder().setURL(`attachment://${fileName}`)),
            {
                ephemeral: true,
                files: [attachment],
            },
        );
    });
