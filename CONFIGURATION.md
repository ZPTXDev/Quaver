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
    "status": {
        "presence": "online",
        "activityType": "Listening",
        "name": "music",
        "url": "",
        "showVersion": true
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
        "smartqueue": {
            "enabled": true,
            "whitelist": false,
            "premium": false
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

| Config Item Path | Description | Required | Version Added |
|---|---|---|---|
| `token` | Your bot token. You can get it from the [Discord Developer Portal](https://discord.com/developers/applications). | ✅ |  |
| `applicationId` | Your application ID. Typically the same as your [bot's user ID](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-).<br />Alternatively, you can get it from the [Discord Developer Portal](https://discord.com/developers/applications). | ✅ |  |
| `clientSecret` | Your client secret. You can get it from the [Discord Developer Portal](https://discord.com/developers/applications) under `OAuth2 > General`. | ✅ |  |
| `colors` | The colors used for embeds. Valid values are available [here](https://discord.js.org/#/docs/discord.js/main/typedef/ColorResolvable). | ✅ |  |
| `status.presence` | The presence. Valid values are `online`, `idle`, `dnd`, and `invisible`. | ✅ | `6.10.0` |
| `status.activityType` | The activity type. Valid values are `Playing`, `Streaming`, `Listening`, `Watching`, and `Competing`. | ✅ | `6.10.0` |
| `status.name` | The activity name. | ✅ | `6.10.0` |
| `status.url` | The activity URL. Only used if `status.activityType` is `Streaming`. | ❌ | `6.10.0` |
| `status.showVersion` | Whether to show the version in the status. | ❌ | `6.10.0` |
| `defaultLocaleCode` | The default locale code. Valid values are available in the `locales` folder.<br />**Note:** This is used for all logs, slash command descriptions (at the time of deployment), and for all guilds without a language set in `/settings`. | ✅ |  |
| `disableAd` | Whether to disable the ad in the `info` command (Sponsor Us button).<br />**Note:** Please do not disable the ad unless you really need to. Sponsors help keep the development of ZPTXDev projects going. Consider sponsoring us if you need to disable the ad! | ❌ |  |
| `supportServer` | The support server invite link. This is used in the `info` command (Support Server button) and some messages in the event of an error. | ❌ | `6.6.0` |
| `premiumURL` | The Get Premium URL. This is used in messages shown when a feature is premium-only. | ❌ | `6.7.0` |
| `managers` | The [user IDs](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-) that are given manager-level permissions on Quaver. | ✅ |  |
| `database.protocol` | The database protocol. Normally `sqlite` or `mysql`. | ✅ |  |
| `database.path` | The database path. For `sqlite`, this is relative to the `dist` folder. | ✅ |  |
| `lavalink.host` | The Lavalink instance host address. | ✅ |  |
| `lavalink.port` | The Lavalink instance port. | ✅ |  |
| `lavalink.password` | The Lavalink instance password. | ✅ |  |
| `lavalink.secure` | Whether or not the Lavalink instance uses a secure connection. | ❌ |  |
| `lavalink.reconnect.delay` | The delay in milliseconds between Lavalink reconnect attempts. | ❌ |  |
| `lavalink.reconnect.tries` | The number of times to attempt to reconnect to Lavalink. | ❌ |  |
| `features.autolyrics` | Auto Lyrics feature: Allows users to toggle Quaver automatically sending lyrics for the current song. | ✅ | `6.7.0` |
| `features.autolyrics.enabled` | Whether or not the feature is enabled. | ✅ | `6.7.0` |
| `features.autolyrics.whitelist` | Whether or not the feature requires guilds to be whitelisted. You will be able to whitelist guilds through the terminal. | ✅ (if feature is enabled)<br />❌ (if feature is disabled) | `6.7.0` |
| `features.autolyrics.premium` | Whether or not to display the "requires premium" message when a guild is not whitelisted. Has no effect if `features.autolyrics.whitelist` is `false` or `premiumURL` is unset. | ✅ (if feature is enabled)<br />❌ (if feature is disabled) | `6.7.0` |
| `features.stay` | 24/7 feature: Allows users to make Quaver stay in their voice channel regardless of activity. | ✅ | |
| `features.stay.enabled` | Whether or not the feature is enabled. | ✅ | |
| `features.stay.whitelist` | Whether or not the feature requires guilds to be whitelisted. You will be able to whitelist guilds through the terminal. | ✅ (if feature is enabled)<br />❌ (if feature is disabled) | |
| `features.stay.premium` | Whether or not to display the "requires premium" message when a guild is not whitelisted. Has no effect if `features.stay.whitelist` is `false` or `premiumURL` is unset. | ✅ (if feature is enabled)<br />❌ (if feature is disabled) | `6.7.0` |
| `features.smartqueue` | Smart Queue feature: Allows users to toggle fair queue sorting, alternating between songs from multiple requesters. | ✅ | `6.8.0` |
| `features.smartqueue.enabled` | Whether or not the feature is enabled. | ✅ | `6.8.0` |
| `features.smartqueue.whitelist` | Whether or not the feature requires guilds to be whitelisted. You will be able to whitelist guilds through the terminal. | ✅ (if feature is enabled)<br />❌ (if feature is disabled) | `6.8.0` |
| `features.smartqueue.premium` | Whether or not to display the "requires premium" message when a guild is not whitelisted. Has no effect if `features.smartqueue.whitelist` is `false` or `premiumURL` is unset. | ✅ (if feature is enabled)<br />❌ (if feature is disabled) | `6.8.0` |
| `features.web` | Web feature: Allows Quaver to handle Socket.IO connections from Quaver-Web. | ✅ | |
| `features.web.enabled` | Whether or not the feature is enabled. | ✅ | |
| `features.web.port` | The port to listen on for Socket.IO connections. | ✅ (if feature is enabled)<br />❌ (if feature is disabled) | |
| `features.web.allowedOrigins` | The allowed origins for Socket.IO connections. | ✅ (if feature is enabled)<br />❌ (if feature is disabled) | |
| `features.web.encryptionKey` | A random encryption key used to secure access tokens. | ✅ (if feature is enabled)<br />❌ (if feature is disabled) | |
| `features.web.https` | HTTPS configuration. | ✅ | |
| `features.web.https.enabled` | Whether or not HTTPS is enabled. | ✅ | `6.0.0` |
| `features.web.https.key` | The path to the HTTPS key file. This is relative to the root folder. | ✅ (if HTTPS is enabled)<br />❌ (if HTTPS is disabled) | `6.0.0` |
| `features.web.https.cert` | The path to the HTTPS certificate file. This is relative to the root folder. | ✅ (if HTTPS is enabled)<br />❌ (if HTTPS is disabled) | `6.0.0` |
| `features.web.dashboardURL` | The URL to the dashboard. If provided, this will be included at the bottom of the Now Playing message as a button. | ❌ | `6.4.0` |
