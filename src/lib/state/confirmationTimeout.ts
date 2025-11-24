import type { Snowflake } from 'discord.js';

export const confirmationTimeout: Record<
    Snowflake,
    ReturnType<typeof setTimeout>
> = {};
