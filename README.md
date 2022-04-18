# Quaver
Quaver is a simple-to-use music bot with features such as bass boost, nightcore, seek, search, and more.

# Using Quaver
Quaver utilizes slash commands, buttons, and menus. After deploying the commands, type `/` into your chat to list Quaver's commands.

# Hosting Quaver
Hosting Quaver is fairly simple. Make a copy of `settings.example.json`, edit the fields as necessary and rename it to `settings.json`.

You are required to host your own instance of [Lavalink](https://github.com/freyacodes/Lavalink) and specify the connection details in `settings.json`.

For a detailed explanation on configuration, view [CONFIGURATION.md](CONFIGURATION.md).

## Prerequisites
- Node.js v16.9.0 (or higher)
- npm (should come bundled with Node.js)
- Lavalink (latest release)
- Bot token from [Discord](https://discord.com/developers/applications)

## Starting Quaver for the first time
Run `npm ci` to install packages required to run Quaver.

Then, run `node deploy-commands.js` **after** you've configured your `settings.json` in order to register your commands on Discord.

Once that's done, run `node main.js` to start the bot. This will be the only command you execute whenever you want to start Quaver from now on.

# FAQ
## What happened to Lyrics?
Unfortunately, due to legal issues, the API that Quaver relied on is no longer able to provide lyrics. Instead of sourcing for an alternative, the command was removed altogether as it simply wasn't worth the effort to keep.

You can probably implement it yourself if you have another API in mind, but I will not provide support for it.

## Can I get in trouble with Google for using this?
Most probably not. They've only been targetting the larger bots so far, but if you really don't wish to take the risk, you can take a sneak peek at Discord's **Watch Together** feature [here](https://discord.gg/discordgameslab).

## Can you add x feature to Quaver?
Yes, if it is meaningful. Submit an issue [here](https://github.com/ZapSquared/Quaver/issues) and I'll be happy to take a look.

## I changed the locale through `/locale`. Why isn't it updating in slash commands?
Slash commands are defined when running `node deploy-commands.js`.

This means that slash command descriptions will follow the locale set in `settings.json` (`defaultLocale` 
key).

## I changed `defaultLocale`, but it isn't updating in slash command descriptions. Why?
You need to re-deploy the commands using `node deploy-commands.js` for the new locale to take effect.

Due to Discord's limitations, it is impossible for each guild to have different locales in slash command descriptions.

# Contributing
Refer to [CONTRIBUTING.md](CONTRIBUTING.md).
