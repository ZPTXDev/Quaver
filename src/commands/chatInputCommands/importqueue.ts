import { MessageOptionsBuilderType } from '#src/lib';
import { ChatInputCommandHandler } from '#src/lib/builders';
import { QuaverGuild } from '#src/lib/guild';
import { getLocaleString } from '#src/lib/locales';
import { Check, settings } from '#src/lib/util';
import type { Track } from '@lavaclient/types';
import { SlashCommandBuilder } from 'discord.js';

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

// Security constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
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

        // Validate encoded string
        if (typeof t.encoded !== 'string' || t.encoded.length > MAX_STRING_LENGTH) {
            return false;
        }

        // Validate info object
        if (typeof t.info !== 'object' || t.info === null) return false;
        const info = t.info as Record<string, unknown>;

        if (typeof info.identifier !== 'string' || info.identifier.length > MAX_STRING_LENGTH) {
            return false;
        }
        if (typeof info.isSeekable !== 'boolean') return false;
        if (typeof info.author !== 'string' || info.author.length > MAX_STRING_LENGTH) {
            return false;
        }
        if (typeof info.length !== 'number' || info.length < 0 || !Number.isFinite(info.length)) {
            return false;
        }
        if (typeof info.isStream !== 'boolean') return false;
        if (typeof info.position !== 'number' || !Number.isFinite(info.position)) {
            return false;
        }
        if (typeof info.title !== 'string' || info.title.length > MAX_STRING_LENGTH) {
            return false;
        }
        if (info.uri !== null && (typeof info.uri !== 'string' || info.uri.length > MAX_STRING_LENGTH)) {
            return false;
        }
        if (typeof info.sourceName !== 'string' || info.sourceName.length > MAX_STRING_LENGTH) {
            return false;
        }
        if (info.artworkUrl !== null && (typeof info.artworkUrl !== 'string' || info.artworkUrl.length > MAX_STRING_LENGTH)) {
            return false;
        }
        if (info.isrc !== null && (typeof info.isrc !== 'string' || info.isrc.length > MAX_STRING_LENGTH)) {
            return false;
        }

        // Validate optional fields
        if (t.requesterId !== undefined && typeof t.requesterId !== 'string') {
            return false;
        }
        if (t.requesterId && t.requesterId.length > MAX_STRING_LENGTH) {
            return false;
        }

        // pluginInfo and userData should be objects
        if (typeof t.pluginInfo !== 'object' || t.pluginInfo === null) return false;
        if (typeof t.userData !== 'object' || t.userData === null) return false;
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
            .addAttachmentOption((option) =>
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

        // Validate file size
        if (attachment.size > MAX_FILE_SIZE) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.IMPORTQUEUE.RESPONSE.FILE_TOO_LARGE'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }

        // Validate file type
        if (attachment.contentType !== 'application/json' && !attachment.name.endsWith('.json')) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.IMPORTQUEUE.RESPONSE.INVALID_FILE'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }

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
                await interaction.replyHandler.reply(
                    guild.locale('CMD.IMPORTQUEUE.RESPONSE.INVALID_FORMAT'),
                    { type: MessageOptionsBuilderType.Error },
                );
                return;
            }

            exportedQueue = data;
        } catch (error) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.IMPORTQUEUE.RESPONSE.INVALID_FORMAT'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }

        // Check if we have any tracks
        if (exportedQueue.tracks.length === 0) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.IMPORTQUEUE.RESPONSE.NO_VALID_TRACKS'),
                { type: MessageOptionsBuilderType.Error },
            );
            return;
        }

        // Convert exported tracks to Track objects
        const tracks: Track[] = exportedQueue.tracks.map((exportedTrack) => ({
            encoded: exportedTrack.encoded,
            info: exportedTrack.info,
            pluginInfo: exportedTrack.pluginInfo,
            userData: exportedTrack.userData,
        }));

        // Add tracks to the queue
        try {
            await player.add(tracks, interaction.user.id, false);

            await interaction.replyHandler.reply(
                guild.locale(
                    'CMD.IMPORTQUEUE.RESPONSE.SUCCESS',
                    tracks.length.toString(),
                ),
            );
        } catch (error) {
            await interaction.replyHandler.reply(
                guild.locale('CMD.IMPORTQUEUE.RESPONSE.LOAD_FAILED'),
                { type: MessageOptionsBuilderType.Error },
            );
        }
    });
