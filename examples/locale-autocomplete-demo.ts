/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Demo file showing locale string autocomplete and type safety features
 *
 * This file demonstrates how developers will use the new LocaleKey type.
 * Open this file in VSCode or another TypeScript-aware IDE to see:
 * 1. Autocomplete suggestions as you type locale keys
 * 2. Hover tooltips showing the English translation
 * 3. Type errors for invalid keys
 */

import type { LocaleKey } from '../src/lib/util/LocaleKeys';
import type { QuaverGuild } from '../src/lib/guild';
import type { Initialized } from '../src/lib/guild/QuaverGuild';

// ============================================================================
// EXAMPLE 1: Static Locale Keys with Autocomplete
// ============================================================================

function exampleStaticKeys(guild: QuaverGuild<Initialized>) {
    // Type 'DISCORD.' and press Ctrl+Space to see all available DISCORD.* keys
    // Hover over the string to see the English translation

    guild.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.STAGE');
    // Hover shows: "Quaver needs to be a **Stage Moderator** of the stage channel."

    guild.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.BASIC');
    // Hover shows: "Quaver needs the **Connect** and **Speak** permissions in the voice channel."

    guild.locale('CMD.PLAY.DESCRIPTION');
    // Hover shows: "Play a track from a supported source."

    guild.locale('MUSIC.NOT_READY');
    // Hover shows: "One moment please! Quaver is still starting up."
}

// ============================================================================
// EXAMPLE 2: Autocomplete by Category
// ============================================================================

function exampleByCategory(guild: QuaverGuild<Initialized>) {
    // Type 'CHECK.' to see all validation check messages
    guild.locale('CHECK.ACTIVE_SESSION');
    guild.locale('CHECK.IN_VOICE');
    guild.locale('CHECK.NOT_REQUESTER');

    // Type 'MUSIC.' to see all music-related messages
    guild.locale('MUSIC.DISCONNECT.ALONE.DISCONNECTED.DEFAULT');
    guild.locale('MUSIC.PLAYER.PLAYING.NOTHING');

    // Type 'CMD.' to see all command messages
    guild.locale('CMD.247.DESCRIPTION');
    guild.locale('CMD.BASSBOOST.DESCRIPTION');
}

// ============================================================================
// EXAMPLE 3: Array of Locale Keys
// ============================================================================

const commonErrorMessages: LocaleKey[] = [
    'CHECK.GUILD_ONLY',
    'CHECK.IN_VOICE',
    'CHECK.IN_SESSION_VOICE',
    'DISCORD.CHANNEL_UNSUPPORTED',
    'DISCORD.GENERIC_ERROR',
];

// ============================================================================
// EXAMPLE 4: Function Parameters with Type Safety
// ============================================================================

function showErrorMessage(guild: QuaverGuild<Initialized>, errorKey: LocaleKey) {
    // The errorKey parameter MUST be a valid LocaleKey
    const message = guild.locale(errorKey);
    console.log(message);
}

// This works - valid key
showErrorMessage({} as QuaverGuild<Initialized>, 'DISCORD.GENERIC_ERROR');

// This would cause a TypeScript error if uncommented:
// showErrorMessage({} as QuaverGuild<Initialized>, 'INVALID.KEY.PATH');
// Error: Argument of type '"INVALID.KEY.PATH"' is not assignable to parameter of type 'LocaleKey'

// ============================================================================
// EXAMPLE 5: Dynamic Keys (Still Supported)
// ============================================================================

function exampleDynamicKeys(guild: QuaverGuild<Initialized>) {
    // Dynamic string construction still works for computed keys
    const state = 'enabled';
    guild.locale(`MISC.${state.toUpperCase()}`);

    // Template strings work too
    const category = 'DISCORD';
    guild.locale(`${category}.GENERIC_ERROR`);

    // You can still use regular strings when needed
    const dynamicKey: string = computeKeyAtRuntime();
    guild.locale(dynamicKey);
}

function computeKeyAtRuntime(): string {
    return 'CMD.PLAY.DESCRIPTION';
}

// ============================================================================
// EXAMPLE 6: Builder Methods Also Support Autocomplete
// ============================================================================

function exampleBuilderMethods(guild: QuaverGuild<Initialized>) {
    // Builder methods also accept LocaleKey, so you get autocomplete there too!

    guild.builders.buttonLocale('MISC.CONFIRM');
    // Hover shows: "Confirm"

    guild.builders.textDisplayLocale('MUSIC.NOT_READY');
    // Hover shows: "One moment please! Quaver is still starting up."

    guild.builders.labelLocale('CMD.INFO.MISC.INVITE');
    // Hover shows: "Invite"
}

// ============================================================================
// EXAMPLE 7: Locale Keys with Variable Substitution
// ============================================================================

function exampleWithVariables(guild: QuaverGuild<Initialized>) {
    // Some locale strings accept variables (marked with %1, %2, etc.)

    guild.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.DEFAULT', 'VIEW_CHANNEL');
    // String: "Quaver is missing permission(s): %1"
    // Result: "Quaver is missing permission(s): VIEW_CHANNEL"

    guild.locale('CMD.247.RESPONSE.QUEUE_CHANNEL_MISSING', '123456789');
    // String: "The queue channel is missing. Try using </bind:%1>."
    // Result: "The queue channel is missing. Try using </bind:123456789>."
}

// ============================================================================
// SUMMARY
// ============================================================================

/**
 * Benefits of this implementation:
 *
 * ✅ Type Safety: Catch typos at compile time instead of runtime
 * ✅ Autocomplete: IDE suggests all 239 available locale paths
 * ✅ Documentation: Hover tooltips show the English translation
 * ✅ Flexibility: Dynamic strings still work when needed
 * ✅ No Breaking Changes: Existing code continues to work
 * ✅ Crowdin Compatible: No changes to locale file format
 * ✅ Auto-Generated: Types regenerate on every build
 */
