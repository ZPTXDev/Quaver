import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { Check, settings } from '#src/lib/util';
import { SlashCommandBuilder } from 'discord.js';

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

// Security constants
// 10 MB maximum file size
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TRACKS = 1000;
const MAX_STRING_LENGTH = 10000;

function isValidExportedQueue(data: unknown): data is ExportedQueue {
    if (typeof data !== 'object' || data === null) return false;

    const queue = data as Record<string, unknown>;

    // Validate top-level structure
    if (typeof queue.version !== 'string' || queue.version.length > 100) return false;
    if (typeof queue.exportedAt !== 'string' || queue.exportedAt.length > 100) return false;
    if (!Array.isArray(queue.tracks)) return false;
    if (queue.tracks.length > MAX_TRACKS) return false;

    // Validate each track
    for (const track of queue.tracks) {
        if (typeof track !== 'object' || track === null) return false;

        const t = track as Record<string, unknown>;

        // Validate required fields
        if (typeof t.encoded !== 'string' || t.encoded.length > MAX_STRING_LENGTH) {
            return false;
        }
        if (typeof t.title !== 'string' || t.title.length > MAX_STRING_LENGTH) {
            return false;
        }
        if (typeof t.author !== 'string' || t.author.length > MAX_STRING_LENGTH) {
            return false;
        }
    }

    return true;
}

export default new ChatInputCommandHandler()
    .setData(
        new SlashCommandBuilder()
            .setName('importqueue')
            .setDescription(
                getLocaleString(
                    settings.defaultLocaleCode,
                    'CMD.IMPORTQUEUE.DESCRIPTION',
                ),
            )
            .addAttachmentOption((option): typeof option =>
                option
                    .setName('file')
                    .setDescription(
                        getLocaleString(
                            settings.defaultLocaleCode,
                            'CMD.IMPORTQUEUE.OPTION.FILE',
                        ),
                    )
                    .setRequired(true),
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

        const attachment = interaction.options.getAttachment('file', true);

        // Validate file size (before deferring)
        if (attachment.size > MAX_FILE_SIZE) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.IMPORTQUEUE.RESPONSE.FILE_TOO_LARGE'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }

        // Validate file type (before deferring)
        if (attachment.contentType !== 'application/json' && !attachment.name.endsWith('.json')) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.IMPORTQUEUE.RESPONSE.INVALID_FILE'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }

        // Defer reply as processing may take time
        await interaction.deferReply();
        let warningSent = false;

        // Set up warning timeout for slow processing
        const warningTimeout = setTimeout(async (): Promise<void> => {
            if (!warningSent) {
                warningSent = true;
                await interaction.replyHandler.reply(
                    guild.locale('MUSIC.QUEUE.SLOW_PROCESSING'),
                    { type: MessageOptionsBuilderType.Warning },
                );
            }
        }, 5000);

        let exportedQueue: ExportedQueue;

        try {
            // Fetch and parse the file
            const response = await fetch(attachment.url);
            if (!response.ok) {
                throw new Error('Failed to fetch file');
            }

            const text = await response.text();
            const data = JSON.parse(text);

            // Validate the structure
            if (!isValidExportedQueue(data)) {
                clearTimeout(warningTimeout);
                await interaction.replyHandler.reply(
                    guild.locale('CMD.IMPORTQUEUE.RESPONSE.INVALID_FORMAT'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }

            exportedQueue = data;
        } catch {
            clearTimeout(warningTimeout);
            await interaction.replyHandler.reply(
                guild.locale('CMD.IMPORTQUEUE.RESPONSE.INVALID_FORMAT'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }

        // Check if we have any tracks
        if (exportedQueue.tracks.length === 0) {
            clearTimeout(warningTimeout);
            await interaction.replyHandler.reply(
                guild.locale('CMD.IMPORTQUEUE.RESPONSE.NO_VALID_TRACKS'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }

        // Show large playlist message if applicable
        if (warningSent && exportedQueue.tracks.length >= 100) {
            await interaction.replyHandler.reply(
                guild.locale('MUSIC.QUEUE.LARGE_PLAYLIST_PROCESSING'),
                { type: MessageOptionsBuilderType.Warning },
            );
        }

        // Decode tracks using Lavalink API
        let decodedTracks = [];

        try {
            // Decode all tracks at once
            const encodedTracks = exportedQueue.tracks.map((t): string => t.encoded);
            const results = await interaction.client.music.api.decodeTracks(encodedTracks);

            // Add metadata to decoded tracks
            decodedTracks = results.map((track): typeof track => {
                track.requesterId = interaction.user.id;
                track.id = crypto.randomUUID();
                return track;
            });
        } catch {
            // If batch decode fails, fall back to individual decoding
            for (const exportedTrack of exportedQueue.tracks) {
                try {
                    const track = await interaction.client.music.api.decodeTrack(exportedTrack.encoded);
                    track.requesterId = interaction.user.id;
                    track.id = crypto.randomUUID();
                    decodedTracks.push(track);
                } catch {
                    // Skip tracks that fail to decode
                    continue;
                }
            }
        }

        // Clear warning timeout
        clearTimeout(warningTimeout);

        // Check if we decoded any tracks
        if (decodedTracks.length === 0) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.IMPORTQUEUE.RESPONSE.NO_VALID_TRACKS'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }

        // Add tracks to the queue
        try {
            await player.addTracksToQueue(decodedTracks, interaction.user.id, false);

            await interaction.replyHandler.reply(
                guild.locale(
                    'CMD.IMPORTQUEUE.RESPONSE.SUCCESS',
                    decodedTracks.length.toString(),
                ),
            );
        } catch {
            await interaction.replyHandler.reply(
                guild.locale('CMD.IMPORTQUEUE.RESPONSE.LOAD_FAILED'),
                { type: MessageOptionsBuilderType.Error },
            );
        }
    });
