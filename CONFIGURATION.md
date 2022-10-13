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
        "stay": {
            "enabled": true,
            "whitelist": false
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
            }
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

`managers` - The [user IDs](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-) that are given manager-level permissions on Quaver.

`database.protocol` - The database protocol.

`database.path` - The database path. This is relative to the `dist` folder.

`lavalink.host` - The Lavalink instance host address.

`lavalink.port` - The Lavalink instance port.

`lavalink.password` - The Lavalink instance password.

`lavalink.secure` - Whether or not the Lavalink instance uses a secure connection.

`lavalink.reconnect.delay` - The delay in milliseconds between Lavalink reconnect attempts.

`lavalink.reconnect.tries` - The number of times to attempt to reconnect to Lavalink.

`features.stay` - 24/7 feature: Allows users to make Quaver stay in their voice channel regardless of activity.

`features.stay.enabled` - Whether or not the feature is enabled.

`features.stay.whitelist` - Whether or not the feature requires guilds to be whitelisted. You will be able to whitelist guilds through the terminal.

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

`features.web.https.enabled` - Whether or not HTTPS is enabled.

`features.web.https.key` - The path to the HTTPS key file. This is relative to the root folder.

`features.web.https.cert` - The path to the HTTPS certificate file. This is relative to the root folder.
