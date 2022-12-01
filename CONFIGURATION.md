# Configuration

```json
{
    "token": "Paste token here",
    "applicationId": "Paste application ID here",
    "clientSecret": "Paste client secret here",
    "colors": {
        "success": "DarkGreen",
        "neutral": "#f39bff",
        "warning": "Orange",
        "error": "DarkRed"
    },
    "defaultLocaleCode": "en",
    "disableAd": false,
    "supportServer": "https://discord.gg/",
    "premiumURL": "https://example.com/premium",
    "managers": [
        "Paste your user ID here"
    ],
    "database": {
        "protocol": "sqlite",
        "path": "../database.sqlite"
    },
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
    "features": {
        "autolyrics": {
            "enabled": true,
            "whitelist": false,
            "premium": false
        },
        "stay": {
            "enabled": true,
            "whitelist": false,
            "premium": false
        },
        "spotify": {
            "enabled": true,
            "client_id": "Paste Spotify Client ID here",
            "client_secret": "Paste Spotify Client Secret here"
        },
        "web": {
            "enabled": false,
            "port": 3000,
            "allowedOrigins": [
                "http://localhost"
            ],
            "encryptionKey": "Type an encryption key here",
            "https": {
                "enabled": false,
                "key": "key.pem",
                "cert": "cert.pem"
            },
            "dashboardURL": "http://example.com"
        }
    }
}
```

`token` - Your bot token. You can get it from the [Discord Developer Portal](https://discord.com/developers/applications).

`applicationId` - Your application ID. Typically the same as your [bot's user ID](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-). You can get it from the [Discord Developer Portal](https://discord.com/developers/applications).

`clientSecret` - Your client secret. You can get it from the [Discord Developer Portal](https://discord.com/developers/applications) under `OAuth2 > General`.

`colors` - The colors used for embeds. Valid values are available [here](https://discord.js.org/#/docs/discord.js/main/typedef/ColorResolvable).

`defaultLocaleCode` - The default locale code. Valid values are available in the `locales` folder.
> **Note:** This is used for all logs, slash command descriptions (at the time of deployment), and for all guilds without a language specified.

`disableAd` - Whether to disable the ad in the `info` command (Sponsor Us button).
> **Note:** Please do not disable the ad unless you really need to. Sponsors help keep the development of ZPTXDev projects going. Consider sponsoring us if you need to disable the ad!

`supportServer` - **6.6.0+** The support server invite link. This is used in the `info` command (Support Server button) and some messages in the event of an error.

`premiumURL` - **6.7.0+** The Get Premium URL. This is used in messages shown when a feature is premium-only.

`managers` - The [user IDs](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-) that are given manager-level permissions on Quaver.

`database.protocol` - The database protocol.

`database.path` - The database path. This is relative to the `dist` folder.

`lavalink.host` - The Lavalink instance host address.

`lavalink.port` - The Lavalink instance port.

`lavalink.password` - The Lavalink instance password.

`lavalink.secure` - Whether or not the Lavalink instance uses a secure connection.

`lavalink.reconnect.delay` - The delay in milliseconds between Lavalink reconnect attempts.

`lavalink.reconnect.tries` - The number of times to attempt to reconnect to Lavalink.

`features.autolyrics` - **6.7.0+** Auto Lyrics feature: Allows users to toggle Quaver automatically sending lyrics for the current song.

`features.autolyrics.enabled` - **6.7.0+** Whether or not the feature is enabled.

`features.autolyrics.whitelist` - **6.7.0+** Whether or not the feature requires guilds to be whitelisted. You will be able to whitelist guilds through the terminal.

`features.autolyrics.premium` - **6.7.0+** Whether or not to display the "requires premium" message when a guild is not whitelisted. Has no effect if `features.autolyrics.whitelist` is `false` or `premiumURL` is unset.

`features.stay` - 24/7 feature: Allows users to make Quaver stay in their voice channel regardless of activity.

`features.stay.enabled` - Whether or not the feature is enabled.

`features.stay.whitelist` - Whether or not the feature requires guilds to be whitelisted. You will be able to whitelist guilds through the terminal.

`features.stay.premium` - **6.7.0+** Whether or not to display the "requires premium" message when a guild is not whitelisted. Has no effect if `features.stay.whitelist` is `false` or `premiumURL` is unset.

`features.spotify` - Spotify feature: Allows users to play songs from Spotify.

`features.spotify.enabled` - Whether or not the feature is enabled.

`features.spotify.client_id` - Your Spotify client ID. You can get it from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).

`features.spotify.client_secret` - Your Spotify client secret. You can get it from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).

`features.web` - Web feature: Allows Quaver to handle WebSocket connections from Quaver-Web.

`features.web.enabled` - Whether or not the feature is enabled.

`features.web.port` - The port to run the WebSocket on.

`features.web.allowedOrigins` - The origins that are allowed to connect to the WebSocket.

`features.web.encryptionKey` - The encryption key used to secure access tokens.

`features.web.https` - HTTPS configuration.

`features.web.https.enabled` - **6.0.0+** Whether or not HTTPS is enabled.

`features.web.https.key` - **6.0.0+** The path to the HTTPS key file. This is relative to the root folder.

`features.web.https.cert` - **6.0.0+** The path to the HTTPS certificate file. This is relative to the root folder.

`features.web.dashboardURL` - **6.4.0+** The URL to the dashboard. If provided, this will be included at the bottom of the Now Playing message as a button.
