import type { ColorResolvable, Snowflake } from 'discord.js';
import { z } from 'zod';

const placeholderCheck = (val: string): boolean =>
    !val.toLowerCase().includes('paste');
const genericPremiumFeatureSchema = z.object({
    enabled: z.boolean().default(false),
    whitelist: z.boolean().default(false),
    premium: z.boolean().default(false),
});

export const SettingsSchema = z.object({
    token: z
        .string()
        .min(1, 'Discord token is required')
        .refine(placeholderCheck, {
            message: 'You must replace the default token placeholder',
        }),
    applicationId: z
        .string()
        .min(1, 'Application ID is required')
        .refine(placeholderCheck, {
            message: 'You must replace the default applicationId placeholder',
        }) as z.ZodType<Snowflake>,
    clientSecret: z
        .string()
        .min(1, 'Client secret is required')
        .refine(placeholderCheck, {
            message: 'You must replace the default clientSecret placeholder',
        }),
    colors: z.object({
        success: z.string() as z.ZodType<ColorResolvable>,
        neutral: z.string() as z.ZodType<ColorResolvable>,
        warning: z.string() as z.ZodType<ColorResolvable>,
        error: z.string() as z.ZodType<ColorResolvable>,
    }),
    emojis: z
        .object({
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
        })
        .optional(),
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
    premiumURL: z.url().optional(),
    managers: z
        .array(z.string() as z.ZodType<Snowflake>)
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
            encryptionKey: z.string().optional(),
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
});

export type Settings = z.infer<typeof SettingsSchema>;
