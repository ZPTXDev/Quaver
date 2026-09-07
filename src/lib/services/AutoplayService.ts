import type { QuaverClient } from '#src/lib';
import type { QuaverGuild } from '#src/lib/guild';
import { logger } from '#src/lib/logger';
import type { QuaverSong } from '#src/lib/util';
import { searchTracks } from '#src/lib/util';

interface ListenBrainzRecording {
    artist_name: string;
    recording_name: string;
    recording_mbid?: string;
}

interface ListenBrainzRecommendationResponse {
    payload: {
        mbids?: ListenBrainzRecording[];
        recording_mbid?: string;
    };
}

/**
 * Service for generating autoplay recommendations using ListenBrainz API
 */
export class AutoplayService {
    private static readonly LISTENBRAINZ_API = 'https://api.listenbrainz.org/1';
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
                logger.info(
                    `[G ${guild.id}] Got ${recommendations.length} ListenBrainz recommendations`,
                );
                return await this.resolveRecommendations(
                    client,
                    guild,
                    recommendations,
                    recentTracks,
                );
            }

            // Fallback to artist-based search
            logger.info(
                `[G ${guild.id}] ListenBrainz returned no results, falling back to artist search`,
            );
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
            // First, try to find the recording MBID by searching
            const searchQuery = `${seedTrack.info.author} ${seedTrack.info.title}`;
            const searchUrl = `${this.LISTENBRAINZ_API}/metadata/lookup/?recording_name=${encodeURIComponent(seedTrack.info.title)}&artist_name=${encodeURIComponent(seedTrack.info.author)}`;

            const searchResponse = await fetch(searchUrl, {
                headers: {
                    'User-Agent': 'Quaver/8.0 (https://github.com/ZPTXDev/Quaver)',
                },
            });

            if (!searchResponse.ok) {
                logger.warn(
                    `ListenBrainz search failed: ${searchResponse.status}`,
                );
                return [];
            }

            const searchData = (await searchResponse.json()) as ListenBrainzRecommendationResponse;
            const recordingMbid = searchData.payload?.recording_mbid;

            if (!recordingMbid) {
                logger.info(
                    `No MusicBrainz ID found for: ${searchQuery}`,
                );
                return [];
            }

            // Now get similar recordings using the MBID
            const recUrl = `${this.LISTENBRAINZ_API}/cf/recommendation/recording/${recordingMbid}`;
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

            const recData = (await recResponse.json()) as ListenBrainzRecommendationResponse;
            const recommendations = recData.payload?.mbids || [];

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
                    logger.debug(
                        `[G ${guild.id}] Skipping duplicate: ${rec.recording_name}`,
                    );
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
