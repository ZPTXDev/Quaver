import type { APIGuild } from 'discord.js';

export type WebGuild = APIGuild & { botInGuild?: boolean };
