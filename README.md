# Quaver
Quaver is a simple-to-use music bot with features such as bass boost, nightcore, seek, search, and more.

# Using Quaver
Quaver utilizes slash commands, buttons, and menus. After deploying the commands, type `/` into your chat to list Quaver's commands.

# Public Instance
Quaver is available for public use [here](https://go.zptx.dev/InviteQuaver), and its dashboard is available [here](https://quaver.zptx.dev). Keep in mind that this instance of Quaver will only run the latest stable version.

# Hosting Quaver
Hosting Quaver is fairly simple. Make a copy of `settings.example.ts`, edit the fields as necessary and rename it to `settings.ts`. Move this file to the `src` directory.

You are required to host your own instance of [Lavalink](https://github.com/freyacodes/Lavalink) and specify the connection details in `settings.ts`.

## Prerequisites
- Node.js v16.9.0 (or higher)
- npm (should come bundled with Node.js)
- Lavalink (latest release)
- Bot token from [Discord](https://discord.com/developers/applications)

## Starting Quaver for the first time
Run `npm ci` to install packages required to run Quaver.

Then, run `npm run slash-deploy` **after** you've configured your `settings.ts` in order to register your commands on Discord.

Once that's done, run `npm run build` to compile the source code. Alternatively, you can run `npm run build-start` to compile the source code and start Quaver in one command.

For subsequent startups, you can simply run `npm start`, which skips the compilation step.

# FAQ
## What happened to Lyrics?
Unfortunately, due to legal issues, the API that Quaver relied on is no longer able to provide lyrics. Instead of sourcing for an alternative, the command was removed altogether as it simply wasn't worth the effort to keep.

You can probably implement it yourself if you have another API in mind, but I will not provide support for it.

## Can I get in trouble with Google for using this?
Most probably not. They've only been targetting the larger bots so far, but if you really don't wish to take the risk, you can take a sneak peek at Discord's **Watch Together** feature [here](https://discord.gg/discordgameslab).

## Can you add x feature to Quaver?
Yes, if it is meaningful. Submit an issue [here](https://github.com/ZPTXDev/Quaver/issues) and I'll be happy to take a look.

## I changed the language through the `/language` command. Why isn't it updating in slash commands?
Slash commands are defined when running `npm run slash-deploy`.

This means that slash command descriptions will follow the language set in `settings.js` (`defaultLocale` key).

## I changed `defaultLocale`, but it isn't updating in slash command descriptions. Why?
You need to re-deploy the commands using `npm run slash-deploy` for the new locale to take effect.

Due to Discord's limitations and the localizations we have, we don't currently use Discord's localized command name & description functionality. This may be worked on in the future.

# Can I control Quaver from a website?
Yes! As of 5.0.0, Quaver has a web dashboard addon available [here](https://github.com/ZPTXDev/Quaver-Web). Please note that this is an optional addon and is not required to run Quaver normally.

# Translating
Take a look at our [Crowdin project](https://translate.zptx.dev).

# Contributing
Refer to [CONTRIBUTING.md](CONTRIBUTING.md).
