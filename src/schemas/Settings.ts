import type { ColorResolvable, Snowflake } from 'discord.js';
import { resolveColor } from 'discord.js';
import { z } from 'zod';

const placeholderCheck = (val: string): boolean =>
    !val.toLowerCase().includes('paste');

const snowflakeSchema = z
    .string()
    .regex(/^\d{17,20}$/, 'Must be a valid Discord snowflake ID');

const colorResolvableSchema = z.string().refine(
    (value): boolean => {
        try {
            resolveColor(value as ColorResolvable);
            return true;
        } catch {
            return false;
        }
    },
    { message: 'Invalid Discord color value' },
);

const genericPremiumFeatureSchema = z.object({
    enabled: z.boolean().default(false),
    whitelist: z.boolean().default(false),
    premium: z.boolean().default(false),
});

const emojiSchema = (
    fallback: string,
): z.ZodDefault<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>> =>
    z.string().transform((val): string => val || fallback).default(fallback);

export const SettingsSchema = z.object({
    token: z
        .string()
        .min(1, 'Discord token is required')
        .refine(placeholderCheck, {
            message: 'You must replace the default token placeholder',
        }),
    applicationId: snowflakeSchema.refine(placeholderCheck, {
        message: 'You must replace the default applicationId placeholder',
    }) as z.ZodType<Snowflake>,
    clientSecret: z
        .string()
        .min(1, 'Client secret is required')
        .refine(placeholderCheck, {
            message: 'You must replace the default clientSecret placeholder',
        }),
    colors: z.object({
        success: colorResolvableSchema as z.ZodType<ColorResolvable>,
        neutral: colorResolvableSchema as z.ZodType<ColorResolvable>,
        warning: colorResolvableSchema as z.ZodType<ColorResolvable>,
        error: colorResolvableSchema as z.ZodType<ColorResolvable>,
    }),
    emojis: z
        .object({
            quavermusic: z.string().default(''),
            youtube: z.string().default(''),
            deezer: z.string().default(''),
            spotify: z.string().default(''),
            soundcloud: z.string().default(''),
            applemusic: z.string().default(''),
            http: z.string().default(''),
            yandexmusic: z.string().default(''),
            'flowery-tts': z.string().default(''),
            vkmusic: z.string().default(''),
            tidal: z.string().default(''),
            pause: emojiSchema('⏸️'),
            resume: emojiSchema('▶️'),
            skip: emojiSchema('⏭️'),
            stop: emojiSchema('⏹️'),
            loop: emojiSchema('🔁'),
            loop_song: emojiSchema('🔂'),
            shuffle: emojiSchema('🔀'),
            left: emojiSchema('⬅️'),
            right: emojiSchema('➡️'),
            link: emojiSchema('🔗'),
            support: emojiSchema('💬'),
            documentation: emojiSchema('📖'),
            sponsor: emojiSchema('💖'),
            website: emojiSchema('🌐'),
            live: emojiSchema('🔴'),
            bassboost: emojiSchema('🅱️'),
            nightcore: emojiSchema('🇳'),
        })
        .default({
            quavermusic: '',
            youtube: '',
            deezer: '',
            spotify: '',
            soundcloud: '',
            applemusic: '',
            http: '',
            yandexmusic: '',
            'flowery-tts': '',
            vkmusic: '',
            tidal: '',
            pause: '⏸️',
            resume: '▶️',
            skip: '⏭️',
            stop: '⏹️',
            loop: '🔁',
            loop_song: '🔂',
            shuffle: '🔀',
            left: '⬅️',
            right: '➡️',
            link: '🔗',
            support: '💬',
            documentation: '📖',
            sponsor: '💖',
            website: '🌐',
            live: '🔴',
            bassboost: '🅱️',
            nightcore: '🇳',
        }),
    status: z.object({
        presence: z.enum(['online', 'idle', 'dnd', 'invisible']),
        activityType: z.enum([
            'Playing',
            'Streaming',
            'Listening',
            'Watching',
            'Competing',
        ]),
        name: z.string(),
        url: z.url().optional().or(z.literal('')),
        showVersion: z.boolean().default(true),
    }),
    defaultLocaleCode: z.string().default('en'),
    developerMode: z.boolean().default(false),
    disableAd: z.boolean().default(false),
    supportServer: z.url().optional(),
    premiumEnabled: z.boolean().default(false),
    managers: z
        .array(snowflakeSchema as z.ZodType<Snowflake>)
        .nonempty('At least one manager ID is required'),
    grafanaLogging: z
        .object({
            host: z.url(),
            appName: z.string(),
            basicAuth: z.string(),
        })
        .optional(),
    database: z.object({
        protocol: z.literal('sqlite'),
        path: z.string().default('database.sqlite'),
    }),
    lavalink: z.object({
        host: z.string(),
        port: z.number().int(),
        password: z.string(),
        secure: z.boolean().default(false),
        reconnect: z
            .object({
                delay: z.number().default(3000),
                tries: z.number().default(5),
            })
            .optional(),
    }),
    features: z.object({
        autolyrics: genericPremiumFeatureSchema,
        stay: genericPremiumFeatureSchema,
        smartqueue: genericPremiumFeatureSchema,
        web: z.object({
            enabled: z.boolean().default(false),
            port: z.number().int().default(3000),
            allowedOrigins: z.array(z.string()).default(['http://localhost']),
            encryptionKey: z
                .string()
                .refine(
                    (val): boolean => val.trim().length >= 32,
                    'Encryption key must be at least 32 characters',
                )
                .refine(
                    (val): boolean =>
                        val.trim() !== 'Type an encryption key here',
                    {
                        message:
                            'You must replace the default encryptionKey placeholder with a secure random key.',
                    },
                )
                .optional(),
            apiSecret: z
                .string()
                .refine(
                    (val): boolean => val.trim().length >= 32,
                    'API secret must be at least 32 characters',
                )
                .refine(
                    (val): boolean =>
                        val.trim() !== 'Type a secure random string here',
                    {
                        message:
                            'You must replace the default apiSecret placeholder with a secure random string.',
                    },
                )
                .optional(),
            https: z
                .object({
                    enabled: z.boolean().default(false),
                    key: z.string().default('key.pem'),
                    cert: z.string().default('cert.pem'),
                })
                .optional(),
            dashboardURL: z.url().optional(),
        }),
    }),
    updater: z
        .object({
            user: z.string().default('ZPTXDev'),
            repo: z.string().default('Quaver'),
            token: z.string().optional(),
            channel: z
                .enum(['none', 'stable', 'staging', 'next'])
                .default('none'),
            install: z.boolean().default(false),
            restartStrategy: z
                .enum(['none', 'immediate', 'track', 'queue'])
                .default('none'),
        })
        .optional(),
    sessionRecovery: z
        .object({
            enabled: z.boolean().default(false),
            maxAge: z.number().default(86400),
            maxAttempts: z.number().default(1),
        })
        .optional(),
    ads: z
        .object({
            enabled: z.boolean().default(false),
            urls: z.array(z.string().url()).default([]),
            intervalMinutes: z.number().int().min(1).default(60),
        })
        .optional(),
});

export type Settings = z.infer<typeof SettingsSchema>;
