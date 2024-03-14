<h1 align="center" style="border-bottom: none;">Quaver</h1>
<h3 align="center">Simple-to-use music bot with features such as bass boost, nightcore, seek, search, and more.</h3>
<p align="center">
    <img alt="GitHub package.json version (branch)" src="https://img.shields.io/github/package-json/v/zptxdev/quaver/master?color=2a005b&label=stable&style=flat-square">
    <img alt="GitHub package.json version (branch)" src="https://img.shields.io/github/package-json/v/zptxdev/quaver/next?color=46041f&label=next&style=flat-square">
</p>
<p align="center">
    <a href="https://www.codefactor.io/repository/github/zptxdev/quaver/overview/next">
        <img alt="CodeFactor Grade" src="https://img.shields.io/codefactor/grade/github/zptxdev/quaver/next?style=flat-square">
    </a>
    <a href="https://go.zptx.dev/discord">
        <img alt="Discord" src="https://img.shields.io/discord/334654301651730432?label=chat%20with%20us&style=flat-square">
    </a>
</p>

# ⚠️ Quaver 7.0.0 Notice

While the release is marked stable, a large part of the code remains untested. The main goal of the release is to provide a hotfix for the `LOAD_FAILED` errors.
Spotify support is temporarily disabled due to internal changes and will be added back in a subsequent version.

# 🎵 Public Instance

Quaver is available for public use [here](https://go.zptx.dev/InviteQuaver), and its dashboard is available [here](https://quaver.zptx.dev). Keep in mind that this instance of Quaver will only run the latest stable version.

# 🚀 Getting Started

## Using Quaver

Quaver utilizes Discord's built-in slash commands, buttons, select menus, modals, and more. After deploying the commands, type `/` into your chat to list Quaver's commands.

As Quaver is designed to be as user-friendly as possible, users should be able to immediately understand how a function works within Quaver without having to read any documentation.

## Prerequisites

- Node.js v16.9.0 (or higher)
- [Lavalink](https://github.com/freyacodes/Lavalink) (latest release is preferred)
> Please note the connection details of your Lavalink instance. You will need to specify them in `settings.json` later.
- Bot token from [Discord](https://discord.com/developers/applications)

## Setup

1. Clone the repository
2. Make a copy of `settings.example.json` and rename it to `settings.json`
3. Edit the fields in `settings.json` as necessary
> Refer to [CONFIGURATION.md](CONFIGURATION.md) for a detailed explanation on configuration.
4. Run `npm ci` to install packages required to run Quaver
5. Run `npm run build` to compile the source code
6. Run `npm run slash-deploy` to deploy slash commands
7. Run `npm start` to start Quaver

# ❔ FAQ

## Can I get in trouble with Google/YouTube for using this?

I cannot guarantee anything. However, the chances of getting into legal trouble is slim if your bot is used privately. I would still exercise caution when hosting any music bot.

## Can you add x feature to Quaver?

I'll consider it! Submit an issue [here](https://github.com/ZPTXDev/Quaver/issues) and I'll be happy to take a look.

## I changed the language through the `/settings` command. Why isn't it updating in slash commands?

Slash commands are defined when running `npm run slash-deploy`.

This means that slash command descriptions will follow the language set in `settings.json` (`defaultLocaleCode` key), and not the language set through the `/settings` command.

## I changed `defaultLocaleCode`, but it isn't updating in slash command descriptions. Why?

You need to re-deploy the commands using `npm run slash-deploy` for the new locale to take effect.

Due to Discord's limitations and the localizations we have, we don't currently use Discord's localized command name & description functionality. This may be worked on in the future.

## Can I control Quaver from some kind of website/dashboard?

Yes! As of **5.0.0**, Quaver has a web dashboard add-on available [here](https://github.com/ZPTXDev/Quaver-Web). Please note that this is an optional addon and is not required to run Quaver normally.

# 💬 Translating

Take a look at our [Crowdin project](https://translate.zptx.dev).

# 📝 Contributing

Refer to [CONTRIBUTING.md](CONTRIBUTING.md).
