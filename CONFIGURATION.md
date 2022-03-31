# Configuration
This aims to explain the settings in the [`settings.json`](settings.json) file.

The file structure is as follows:
```json
{
  "token": "Paste token here",
  "applicationId": "Paste application ID here",
  "defaultColor": "#f39bff",
  "defaultLocale": "en-US",
  "managers": [
    "Paste your user ID here"
  ],
  "lavalink": {
    "host": "localhost",
    "port": 12345,
    "password": "youshallnotpass",
    "secure": false,
    "reconnect": {
      "delay": 3000,
      "tries": 5
    }
  },
  "spotify": {
    "client_id": "Paste Spotify Client ID here",
    "client_secret": "Paste Spotify Client Secret here"
  },
  "functions": {
    "247": {
      "enabled": true,
      "whitelist": false
    }
  }
}
```

`token`
> The Discord token for your bot. Get it from [here](https://discord.com/developers/applications).

`applicationId`
> The Discord application ID for your bot. Usually the same as your bot's user ID. You can also get this from [here](https://discord.com/developers/applications).

`defaultColor`
> A [`ColorResolvable`](https://discord.js.org/#/docs/main/stable/typedef/ColorResolvable) color. Used in every non-error message embed from Quaver.

`defaultLocale`
> Any locale from [locales](locales) without the file extension. Quaver will not start if an invalid locale is selected.

> This locale is also used for all logs, slash command descriptions, and for all guilds that don't specify a locale.

> If changing default locale, re-deploy commands for it to take effect in slash command descriptions.

`managers`
> An array of user IDs that are given manager-level permission on Quaver. For now, it only affects the `volume` command.

`lavalink.host`
> The host IP of the Lavalink instance.

`lavalink.port`
> The port that Lavalink is listening on.

> Defined in `application.yml` (`server.port`)

`lavalink.password`
> The password configured for the Lavalink instance.

> Defined in `application.yml` (`lavalink.server.password`)

`lavalink.secure`
> Whether or not the Lavalink instance is secure. Defaults to `false` if unspecified.

`lavalink.reconnect.delay`
> The delay between reconnect attempts. Defaults to `3000` if unspecified.

`lavalink.reconnect.tries`
> The number of reconnect attempts before giving up. Defaults to `5` if unspecified.

`spotify.client_id`
> Spotify API Client ID, obtainable [here](https://developer.spotify.com/dashboard/applications). Used to resolve Spotify tracks.

`spotify.client_secret`
> Spotify API Client Secret, obtainable [here](https://developer.spotify.com/dashboard/applications). Used to authenticate your Spotify application.

`functions.247.enabled`
> Whether or not the **24/7** feature is enabled.

`functions.247.whitelist`
> Whether or not the **24/7** feature requires guilds to be whitelisted.
