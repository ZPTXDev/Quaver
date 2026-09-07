import type { QuaverClient } from '#src/lib';
import type { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import type { QuaverSong } from '#src/lib/util';
import { searchTracks, settings } from '#src/lib/util';

interface ListenBrainzRecording {
    artist_name: string;
    recording_name: string;
    recording_mbid: string;
}

interface ListenBrainzLookupResponse {
    recording_mbid?: string;
    recording_name?: string;
    artist_credit_name?: string;
}

interface ListenBrainzLabsRecording {
    recording_mbid: string;
    recording_name?: string;
    artist_credit_name?: string;
    score?: number;
}

/**
 * Service for generating autoplay recommendations using ListenBrainz API
 */
export class AutoplayService {
    private static readonly LISTENBRAINZ_API = 'https://api.listenbrainz.org/1';
    private static readonly LISTENBRAINZ_LABS_API = 'https://labs.api.listenbrainz.org';
    private static readonly MAX_RECOMMENDATIONS = 10;
    private static readonly DEDUPE_HISTORY_SIZE = 50;

    /**
     * Generate autoplay recommendations based on a seed track
     * @param client The Quaver client
     * @param guild The guild context
     * @param seedTrack The track to base recommendations on
     * @param recentTracks Recently played tracks to deduplicate against
     * @returns Array of recommended tracks
     */
    static async generateRecommendations(
        client: QuaverClient,
        guild: QuaverGuild,
        seedTrack: QuaverSong,
        recentTracks: QuaverSong[] = [],
    ): Promise<QuaverSong[]> {
        try {
            // Try ListenBrainz recommendations first
            const recommendations = await this.getListenBrainzRecommendations(
                seedTrack,
            );

            if (recommendations.length > 0) {
                return await this.resolveRecommendations(
                    client,
                    guild,
                    recommendations,
                    recentTracks,
                );
            }

            // Fallback to artist-based search
            return await this.getArtistBasedRecommendations(
                client,
                guild,
                seedTrack,
                recentTracks,
            );
        } catch (error) {
            logger.error(
                `[G ${guild.id}] Error generating autoplay recommendations:`,
                error,
            );
            // Try fallback
            try {
                return await this.getArtistBasedRecommendations(
                    client,
                    guild,
                    seedTrack,
                    recentTracks,
                );
            } catch (fallbackError) {
                logger.error(
                    `[G ${guild.id}] Fallback recommendations also failed:`,
                    fallbackError,
                );
                return [];
            }
        }
    }

    /**
     * Get recommendations from ListenBrainz API
     */
    private static async getListenBrainzRecommendations(
        seedTrack: QuaverSong,
    ): Promise<ListenBrainzRecording[]> {
        try {
            // Check if token is configured
            if (!settings.features.autoplay.listenbrainzToken) {
                logger.warn('ListenBrainz token not configured, skipping API recommendations');
                return [];
            }

            // First, try to find the recording MBID by searching
            const searchQuery = `${seedTrack.info.author} ${seedTrack.info.title}`;
            const searchUrl = `${this.LISTENBRAINZ_API}/metadata/lookup/?recording_name=${encodeURIComponent(seedTrack.info.title)}&artist_name=${encodeURIComponent(seedTrack.info.author)}`;

            const searchResponse = await fetch(searchUrl, {
                headers: {
                    'User-Agent': 'Quaver/8.0 (https://github.com/ZPTXDev/Quaver)',
                    'Authorization': `Token ${settings.features.autoplay.listenbrainzToken}`,
                },
            });

            if (!searchResponse.ok) {
                logger.warn(
                    `ListenBrainz search failed: ${searchResponse.status}`,
                );
                return [];
            }

            const searchData = (await searchResponse.json()) as ListenBrainzLookupResponse;
            const recordingMbid = searchData.recording_mbid;

            if (!recordingMbid) {
                return [];
            }

            // Now get similar recordings using the MBID via Labs API
            // Use the optimized algorithm for active user listening patterns
            const algorithm = 'session_based_days_7500_session_300_contribution_5_threshold_15_limit_50_skip_30_top_n_listeners_1000';
            const recUrl = `${this.LISTENBRAINZ_LABS_API}/similar-recordings/json?recording_mbids=${recordingMbid}&algorithm=${algorithm}`;
            const recResponse = await fetch(recUrl, {
                headers: {
                    'User-Agent': 'Quaver/8.0 (https://github.com/ZPTXDev/Quaver)',
                },
            });

            if (!recResponse.ok) {
                logger.warn(
                    `ListenBrainz recommendations failed: ${recResponse.status}`,
                );
                return [];
            }

            const recData = (await recResponse.json()) as ListenBrainzLabsRecording[];

            // Labs API returns an array of recordings with metadata
            const recommendations: ListenBrainzRecording[] = recData.map((rec) => ({
                recording_mbid: rec.recording_mbid,
                artist_name: rec.artist_credit_name || 'Unknown Artist',
                recording_name: rec.recording_name || 'Unknown Track',
            }));

            return recommendations.slice(0, this.MAX_RECOMMENDATIONS);
        } catch (error) {
            logger.error('ListenBrainz API error:', error);
            return [];
        }
    }

    /**
     * Resolve ListenBrainz recommendations to playable tracks
     */
    private static async resolveRecommendations(
        client: QuaverClient,
        guild: QuaverGuild,
        recommendations: ListenBrainzRecording[],
        recentTracks: QuaverSong[],
    ): Promise<QuaverSong[]> {
        const tracks: QuaverSong[] = [];
        const recentTrackIds = new Set(
            recentTracks
                .slice(-this.DEDUPE_HISTORY_SIZE)
                .map((t): string => `${t.info.author}:${t.info.title}`.toLowerCase()),
        );

        for (const rec of recommendations) {
            try {
                const trackId = `${rec.artist_name}:${rec.recording_name}`.toLowerCase();

                // Skip if recently played
                if (recentTrackIds.has(trackId)) {
                    continue;
                }

                const query = `${rec.artist_name} ${rec.recording_name}`;
                const result = await searchTracks(client, guild, query);

                if (result.loadType === 'search' && result.data.length > 0) {
                    const track = result.data[0];
                    track.id = crypto.randomUUID();
                    track.requesterId = client.user.id;
                    tracks.push(track);
                    recentTrackIds.add(trackId); // Prevent duplicates within this batch
                } else if (result.loadType === 'track') {
                    const track = result.data;
                    track.id = crypto.randomUUID();
                    track.requesterId = client.user.id;
                    tracks.push(track);
                    recentTrackIds.add(trackId);
                }

                // Stop if we have enough tracks
                if (tracks.length >= 5) {
                    break;
                }
            } catch (error) {
                logger.warn(
                    `[G ${guild.id}] Failed to resolve recommendation: ${rec.recording_name}`,
                    error,
                );
                continue;
            }
        }

        return tracks;
    }

    /**
     * Fallback: Get recommendations by searching for the artist
     */
    private static async getArtistBasedRecommendations(
        client: QuaverClient,
        guild: QuaverGuild,
        seedTrack: QuaverSong,
        recentTracks: QuaverSong[],
    ): Promise<QuaverSong[]> {
        const tracks: QuaverSong[] = [];
        const recentTrackIds = new Set(
            recentTracks
                .slice(-this.DEDUPE_HISTORY_SIZE)
                .map((t): string => `${t.info.author}:${t.info.title}`.toLowerCase()),
        );

        try {
            // Search for tracks by the same artist
            const query = `${seedTrack.info.author}`;
            const result = await searchTracks(client, guild, query);

            if (result.loadType === 'search') {
                for (const track of result.data) {
                    const trackId = `${track.info.author}:${track.info.title}`.toLowerCase();

                    // Skip if recently played or is the seed track
                    if (recentTrackIds.has(trackId)) {
                        continue;
                    }

                    // Filter out very short or very long tracks
                    if (track.info.length < 60000 || track.info.length > 900000) {
                        continue;
                    }

                    track.id = crypto.randomUUID();
                    track.requesterId = client.user.id;
                    tracks.push(track);
                    recentTrackIds.add(trackId);

                    if (tracks.length >= 5) {
                        break;
                    }
                }
            }
        } catch (error) {
            logger.error(
                `[G ${guild.id}] Artist-based recommendations failed:`,
                error,
            );
        }

        return tracks;
    }

    /**
     * Check if a track is suitable for autoplay (duration filter)
     */
    static isTrackSuitable(track: QuaverSong): boolean {
        // Filter out streams and tracks outside reasonable duration
        if (track.info.isStream) {
            return false;
        }
        if (track.info.length < 60000) {
            // Less than 1 minute
            return false;
        }
        if (track.info.length > 900000) {
            // More than 15 minutes
            return false;
        }
        return true;
    }
}
