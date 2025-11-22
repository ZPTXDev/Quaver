# Type-safe Locale Strings - Usage Example

This document demonstrates the new type-safe locale string access feature.

## Overview

The project now includes auto-generated TypeScript types for all locale string paths, providing:
- **Autocomplete support** in IDEs (VSCode, WebStorm, etc.)
- **Type safety** to catch typos at compile time
- **Hover tooltips** showing the English translation

## How It Works

1. The script `scripts/generate-locale-types.ts` reads all locale files from `locales/en/`
2. It generates a union type `LocaleKey` containing all possible locale paths
3. The type includes JSDoc comments with the English string value for each key
4. This type is used in `QuaverGuild.locale()` and `getLocaleString()` functions

## Usage Examples

### Before (no autocomplete, prone to typos)
```typescript
// No autocomplete, easy to make mistakes
guild.locale('DISCORD.INSUFFICIENT_PERMISIONS.BOT.STAGE'); // Typo! Would fail at runtime
```

### After (with autocomplete and type safety)
```typescript
// IDE provides autocomplete as you type
// Hover over the string to see: "Quaver needs to be a **Stage Moderator** of the stage channel."
guild.locale('DISCORD.INSUFFICIENT_PERMISSIONS.BOT.STAGE');

// TypeScript suggests corrections if you make a typo
guild.locale('DISCORD.INSUFFICIENT_PERMISIONS.BOT.STAGE'); 
// IDE highlights this and suggests the correct path

// Autocomplete suggests all available paths starting with 'DISCORD.'
guild.locale('DISCORD.'); // Shows all DISCORD.* paths
```

### Dynamic Keys (Still Supported)
The type system is flexible and allows dynamic string construction for cases where locale keys are computed at runtime:

```typescript
// Dynamic keys still work when needed
const state = 'enable';
guild.locale(`MISC.${state.toUpperCase()}`); // Works fine

// Or with template strings
const category = 'DISCORD';
guild.locale(`${category}.GENERIC_ERROR`);
```

## Regenerating Types

The locale types are automatically regenerated during the build process. You can also regenerate them manually:

```bash
npm run generate:locale-types
```

This should be done whenever:
- New locale strings are added
- Existing locale strings are modified
- Locale file structure changes

## Files Modified

- `src/lib/guild/QuaverGuild.ts` - Updated `locale()` method signature
- `src/lib/util/util.ts` - Updated `getLocaleString()` function signature
- `src/lib/util/LocaleKeys.d.ts` - Auto-generated type definitions (239 locale paths)
- `scripts/generate-locale-types.ts` - Type generation script
- `package.json` - Added `generate:locale-types` script and `tsx` dev dependency

## Crowdin Compatibility

This feature does not interfere with Crowdin workflows:
- Locale files remain in their original JavaScript format
- The type generation reads from the English locale files only
- No changes required to the translation workflow
- The generated types are purely for TypeScript development aid

## IDE Support

Works with any TypeScript-aware IDE:
- Visual Studio Code
- WebStorm / IntelliJ IDEA
- Sublime Text with TypeScript plugin
- Vim/Neovim with LSP
- And more!
