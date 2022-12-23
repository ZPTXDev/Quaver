<h1 align="center" style="border-bottom: none;">Quaver</h1>
<h3 align="center">Simple-to-use music bot with features such as bass boost, nightcore, seek, search, and more.</h3>
<p align="center">
    <a href="#">
        <img alt="GitHub package.json version (branch)" src="https://img.shields.io/github/package-json/v/zptxdev/quaver/master?color=2a005b&label=stable&style=flat-square">
    </a>
    <a href="#">
        <img alt="GitHub package.json version (branch)" src="https://img.shields.io/github/package-json/v/zptxdev/quaver/next?color=46041f&label=next&style=flat-square">
    </a>
</p>
<p align="center">
    <a href="https://www.codefactor.io/repository/github/zptxdev/quaver/overview/next">
        <img alt="CodeFactor Grade" src="https://img.shields.io/codefactor/grade/github/zptxdev/quaver/next?style=flat-square">
    </a>
    <a href="https://discord.gg/NXcFmBE">
        <img alt="Discord" src="https://img.shields.io/discord/334654301651730432?label=chat%20with%20us&style=flat-square">
    </a>
</p>

# Using Quaver
Quaver utilizes slash commands, buttons, and menus. After deploying the commands, type `/` into your chat to list Quaver's commands.

# Public Instance
Quaver is available for public use [here](https://go.zptx.dev/InviteQuaver), and its dashboard is available [here](https://quaver.zptx.dev). Keep in mind that this instance of Quaver will only run the latest stable version.

# Hosting Quaver
Hosting Quaver is fairly simple. Make a copy of `settings.example.json`, edit the fields as necessary and rename it to `settings.json`. An explanation on each property is available [here](CONFIGURATION.md).

You are required to host your own instance of [Lavalink](https://github.com/freyacodes/Lavalink) and specify the connection details in `settings.json`.

## Prerequisites
- Node.js v16.9.0 (or higher)
- npm (should come bundled with Node.js)
- Lavalink (latest release)
- Bot token from [Discord](https://discord.com/developers/applications)

## Starting Quaver for the first time
Run `npm ci` to install packages required to run Quaver.

Run `npm run build` to compile the source code. Alternatively, you can run `npm run build-start` to compile the source code and start Quaver in one command.

You can deploy slash commands after the build by running `npm run slash-deploy`.

For subsequent startups, you can simply run `npm start`, which skips the compilation step.

# FAQ
## Can I get in trouble with Google for using this?
Most probably not. They've only been targetting the larger bots so far, but if you really don't wish to take the risk, you can take a sneak peek at Discord's **Watch Together** feature [here](https://discord.gg/discordgameslab).

## Can you add x feature to Quaver?
Yes, if it is meaningful. Submit an issue [here](https://github.com/ZPTXDev/Quaver/issues) and I'll be happy to take a look.

## I changed the language through the `/settings` command. Why isn't it updating in slash commands?
Slash commands are defined when running `npm run slash-deploy`.

This means that slash command descriptions will follow the language set in `settings.json` (`defaultLocaleCode` key).

## I changed `defaultLocaleCode`, but it isn't updating in slash command descriptions. Why?
You need to re-deploy the commands using `npm run slash-deploy` for the new locale to take effect.

Due to Discord's limitations and the localizations we have, we don't currently use Discord's localized command name & description functionality. This may be worked on in the future.

# Can I control Quaver from a website?
Yes! As of 5.0.0, Quaver has a web dashboard add-on available [here](https://github.com/ZPTXDev/Quaver-Web). Please note that this is an optional addon and is not required to run Quaver normally.

# Translating
Take a look at our [Crowdin project](https://translate.zptx.dev).

# Contributing
Refer to [CONTRIBUTING.md](CONTRIBUTING.md).
