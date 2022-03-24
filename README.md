# Quaver
As YouTube cracks down on music bots on Discord, hosting large-scale bots for this purpose is no longer feasible. Previously, Quaver was written to be run just like that.

Starting from version **2.0.0**, that will no longer be the case.

Quaver will now use a simpler system to handle requests and its focus will be shifted to serving a smaller community, with an aim to be self-hosted without much hassle.

Quaver was written to use both slash commands and normal commands, but with this rewrite, only slash commands will be accepted, alongside buttons and menus.

# Hosting Quaver
Hosting Quaver is fairly simple. Make a copy of `settings.example.json`, edit the fields as necessary and rename it to `settings.json`.

You are required to host your own instance of [Lavalink](https://github.com/freyacodes/Lavalink) and specify the connection details in `settings.json`.

For a detailed explanation on configuration, view [CONFIGURATION.md](CONFIGURATION.md).

From version **2.0.0**, you are no longer required to specify MySQL connection details as Quaver will use JSON for guild data.

## Prerequisites
- Node.js v16.0.0 (or higher)
- npm (should come with Node.js)
- Lavalink (latest release)
- Bot token from [Discord](https://discord.com/developers/applications)

## Starting Quaver for the first time
In a Terminal, Command Prompt, Shell or however you access `node`, run `npm i` to install packages required to run Quaver.

Then, run `node deploy-commands.js` **after** you've configured your `settings.json` in order to register your commands on Discord.

Once that's done, run `node main.js` to start the bot. This will be the only command you execute whenever you want to start Quaver from now on.

# FAQ
## What happened to Lyrics?
Unfortunately, due to legal issues, the API that Quaver relied on is no longer able to provide lyrics. Instead of sourcing for an alternative, the command was removed altogether as it simply wasn't worth the effort to keep.

You can probably implement it yourself if you have another API in mind, but I will provide no support for it.

## Will Google send me a legal letter if I run Quaver for my community?
Most probably not. They've only been targetting the larger bots so far, but if you really don't wish to take the risk, you can take a sneak peek at Discord's new **Watch Together** feature [here](https://discord.gg/discordgameslab).

## Can you add x feature to Quaver?
Yes, if it is meaningful. Submit an issue [here](https://github.com/ZapSquared/Quaver/issues) and I'll take a look.

## I changed the locale through `/locale`. Why isn't it updating in slash commands?
Unfortunately, slash commands are defined when running `node deploy-commands.js`.

This means that slash command descriptions and console logs will follow the locale set in `settings.json` (`defaultLocale` key).

## I changed `defaultLocale`, but it isn't updating in slash command descriptions. Why?
You need to re-deploy the commands using `node deploy-commands.js` for the new locale to take effect. Logs, however, update immediately.

# Contributing
Refer to [CONTRIBUTING.md](CONTRIBUTING.md).