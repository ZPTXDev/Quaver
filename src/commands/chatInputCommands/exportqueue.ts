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
    info: {
        identifier: string;
        isSeekable: boolean;
        author: string;
        length: number;
        isStream: boolean;
        position: number;
        title: string;
        uri: string | null;
        sourceName: string;
        artworkUrl: string | null;
        isrc: string | null;
    };
    pluginInfo: Record<string, unknown>;
    userData: Record<string, unknown>;
    requesterId?: string;
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

        if (player.queue.tracks.length === 0) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.EXPORTQUEUE.RESPONSE.QUEUE_EMPTY'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }

        // Create the export data
        const exportData: ExportedQueue = {
            version: version.version,
            exportedAt: new Date().toISOString(),
            tracks: player.queue.tracks.map((track: Song): ExportedTrack => ({
                encoded: track.encoded,
                info: {
                    identifier: track.info.identifier,
                    isSeekable: track.info.isSeekable,
                    author: track.info.author,
                    length: track.info.length,
                    isStream: track.info.isStream,
                    position: track.info.position,
                    title: track.info.title,
                    uri: track.info.uri,
                    sourceName: track.info.sourceName,
                    artworkUrl: track.info.artworkUrl,
                    isrc: track.info.isrc,
                },
                pluginInfo: track.pluginInfo,
                userData: track.userData,
                requesterId: track.requesterId,
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
                            player.queue.tracks.length.toString(),
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
