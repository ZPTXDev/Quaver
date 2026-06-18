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
  "emojis": {
    "quavermusic": "",
    "youtube": "",
    "deezer": "",
    "spotify": "",
    "soundcloud": "",
    "applemusic": "",
    "http": "",
    "yandexmusic": "",
    "flowery-tts": "",
    "vkmusic": "",
    "tidal": "",
    "pause": "",
    "resume": "",
    "skip": "",
    "stop": "",
    "loop": "",
    "loop_song": "",
    "shuffle": "",
    "left": "",
    "right": "",
    "link": "",
    "support": "",
    "documentation": "",
    "sponsor": "",
    "website": "",
    "live": "",
    "bassboost": "",
    "nightcore": ""
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
  "premiumEnabled": false,
  "managers": [
    "Paste your user ID here"
  ],
  "database": {
    "protocol": "sqlite",
    "path": "database.sqlite"
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
      "apiSecret": "Type a secure random string here",
      "https": {
        "enabled": false,
        "key": "key.pem",
        "cert": "cert.pem"
      },
      "dashboardURL": "http://example.com"
    }
  },
  "updater": {
    "channel": "stable",
    "install": true,
    "restartStrategy": "none"
  },
  "sessionRecovery": {
    "enabled": true,
    "maxAge": 86400,
    "maxAttempts": 1
  },
  "connectionHealth": {
    "gateway": {
      "unstablePingThresholdMs": 500,
      "unstableReconnectThreshold": 5,
      "sampleIntervalSeconds": 10,
      "sampleWindowSize": 20
    },
    "media": {
      "checkIntervalSeconds": 60,
      "unstableLatencyMs": 2000,
      "consecutiveFailureThreshold": 3,
      "checkTimeoutMs": 2000
    }
  },
  "ads": {
    "enabled": false,
    "urls": [],
    "intervalMinutes": 60
  }
}
```

## Multi-Node Lavalink Configuration

Quaver supports connecting to multiple Lavalink nodes for improved reliability, load distribution, and region-based routing. To enable multi-node mode, replace the `lavalink` object with a `nodes` array:

```json
{
  "lavalink": {
    "nodes": [
      {
        "host": "sg-lavalink.example.com",
        "port": 2333,
        "password": "youshallnotpass",
        "secure": true,
        "region": "singapore",
        "reconnect": {
          "delay": 3000,
          "tries": 5
        }
      },
      {
        "host": "us-lavalink.example.com",
        "port": 2333,
        "password": "youshallnotpass",
        "secure": true,
        "region": "us-central",
        "reconnect": {
          "delay": 3000,
          "tries": 5
        }
      },
      {
        "host": "eu-lavalink.example.com",
        "port": 2333,
        "password": "youshallnotpass",
        "secure": true,
        "region": "rotterdam",
        "reconnect": {
          "delay": 3000,
          "tries": 5
        }
      }
    ]
  }
}
```

### Multi-Node Features

- **Ping-Based Region Affinity**: Quaver learns which Lavalink nodes provide the best latency for different Discord media regions over time, automatically routing new connections to the optimal node
- **Intelligent Load Balancing**: Uses penalty-based selection considering CPU load, active players, and frame statistics
- **Automatic Failover**: If a node becomes unavailable, new players route to healthy nodes
- **Session Recovery**: Players can be restored after restarts, maintaining node affinity when possible

> **Note**: The `region` field in each node configuration is an internal identifier for affinity tracking. You can set it to any value you prefer (e.g., `"sg1"`, `"us-east"`, `"europe"`). It's not matched against Discord's voice regions.


| Config Item Path                                      | Description                                                                                                                                                                                                                                                                                                                                                       | Required                                                  | Version Added |
|-------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------|---------------|
| `token`                                               | Your bot token. You can get it from the [Discord Developer Portal](https://discord.com/developers/applications).                                                                                                                                                                                                                                                  | ✅                                                         |               |
| `applicationId`                                       | Your application ID. Typically the same as your [bot's user ID](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-).<br />Alternatively, you can get it from the [Discord Developer Portal](https://discord.com/developers/applications).                                                                        | ✅                                                         |               |
| `clientSecret`                                        | Your client secret. You can get it from the [Discord Developer Portal](https://discord.com/developers/applications) under `OAuth2 > General`.                                                                                                                                                                                                                     | ✅                                                         |               |
| `colors`                                              | The colors used for embeds. Valid values are available [here](https://discord.js.org/docs/packages/discord.js/main/ColorResolvable:TypeAlias).                                                                                                                                                                                                                    | ✅                                                         |               |
| `emojis`                                              | The emojis used for different sources. Valid values are the Unicode emoji, or a custom Discord emoji (<:name:id>).                                                                                                                                                                                                                                                | ❌                                                         | `7.2.0`       |
| `status.presence`                                     | The presence. Valid values are `online`, `idle`, `dnd`, and `invisible`.                                                                                                                                                                                                                                                                                          | ✅                                                         | `6.10.0`      |
| `status.activityType`                                 | The activity type. Valid values are `Playing`, `Streaming`, `Listening`, `Watching`, and `Competing`.                                                                                                                                                                                                                                                             | ✅                                                         | `6.10.0`      |
| `status.name`                                         | The activity name.                                                                                                                                                                                                                                                                                                                                                | ✅                                                         | `6.10.0`      |
| `status.url`                                          | The activity URL. Only used if `status.activityType` is `Streaming`.                                                                                                                                                                                                                                                                                              | ❌                                                         | `6.10.0`      |
| `status.showVersion`                                  | Whether to show the version in the status.                                                                                                                                                                                                                                                                                                                        | ❌                                                         | `6.10.0`      |
| `defaultLocaleCode`                                   | The default locale code. Valid values are available in the `locales` folder.<br />**Note:** This is used for all logs, slash command descriptions (at the time of deployment), and for all guilds without a language set in `/settings`.                                                                                                                          | ✅                                                         |               |
| `disableAd`                                           | Whether to disable the ad in the `info` command (Sponsor Us button).<br />**Note:** Please do not disable the ad unless you really need to. Sponsors help keep the development of ZPTXDev projects going. Consider sponsoring us if you need to disable the ad!                                                                                                   | ❌                                                         |               |
| `supportServer`                                       | The support server invite link. This is used in the `info` command (Support Server button) and some messages in the event of an error.                                                                                                                                                                                                                            | ❌                                                         | `6.6.0`       |
| `premiumEnabled`                                      | Whether premium features are enabled. When `true`, premium upsell messages will include a "Get Premium" button linking to `<dashboardURL>/guild/<guildId>?premium=true`. This flag also controls whether premium-gated features check for guild whitelisting.                                                                                                     | ❌                                                         | `8.0.0`       |
| `managers`                                            | The [user IDs](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-) that are given manager-level permissions on Quaver.                                                                                                                                                                                           | ✅                                                         |               |
| `database.protocol`                                   | The database protocol. At this time, only `sqlite` is supported.                                                                                                                                                                                                                                                                                                  | ✅                                                         |               |
| `database.path`                                       | The database path. For `sqlite`, this is relative to your Quaver directory containing `dist`, `locales`, etc.                                                                                                                                                                                                                                                     | ✅                                                         |               |
| `lavalink.host`                                       | The Lavalink instance host address. **Single-node mode only.** Use `lavalink.nodes` for multi-node configuration.                                                                                                                                                                                                                                                | ✅ (single-node)<br />❌ (multi-node)                      |               |
| `lavalink.port`                                       | The Lavalink instance port. **Single-node mode only.**                                                                                                                                                                                                                                                                                                            | ✅ (single-node)<br />❌ (multi-node)                      |               |
| `lavalink.password`                                   | The Lavalink instance password. **Single-node mode only.**                                                                                                                                                                                                                                                                                                        | ✅ (single-node)<br />❌ (multi-node)                      |               |
| `lavalink.secure`                                     | Whether the Lavalink instance uses a secure connection. **Single-node mode only.**                                                                                                                                                                                                                                                                                | ❌                                                         |               |
| `lavalink.reconnect.delay`                            | The delay in milliseconds between Lavalink reconnect attempts. **Single-node mode only.**                                                                                                                                                                                                                                                                         | ❌                                                         |               |
| `lavalink.reconnect.tries`                            | The number of times to attempt to reconnect to Lavalink. **Single-node mode only.**                                                                                                                                                                                                                                                                               | ❌                                                         |               |
| `lavalink.nodes`                                      | Array of Lavalink node configurations for multi-node mode. When specified, enables intelligent load balancing and region-based routing across multiple Lavalink servers. **Multi-node mode only.** Mutually exclusive with single-node fields (`host`, `port`, `password`, etc.).                                                                                | ✅ (multi-node)<br />❌ (single-node)                      | `8.0.0`       |
| `lavalink.nodes[].host`                               | The Lavalink node host address.                                                                                                                                                                                                                                                                                                                                   | ✅ (multi-node)                                            | `8.0.0`       |
| `lavalink.nodes[].port`                               | The Lavalink node port.                                                                                                                                                                                                                                                                                                                                           | ✅ (multi-node)                                            | `8.0.0`       |
| `lavalink.nodes[].password`                           | The Lavalink node password.                                                                                                                                                                                                                                                                                                                                       | ✅ (multi-node)                                            | `8.0.0`       |
| `lavalink.nodes[].secure`                             | Whether the Lavalink node uses a secure connection.                                                                                                                                                                                                                                                                                                               | ❌                                                         | `8.0.0`       |
| `lavalink.nodes[].region`                             | Discord voice region this node serves (e.g., `singapore`, `us-central`, `rotterdam`). Players in voice channels with matching `rtcRegion` will route to nodes configured for that region. If multiple nodes serve the same region, load balancing determines which node is used. Must match region IDs from Discord's `/voice/regions` API.                       | ❌                                                         | `8.0.0`       |
| `lavalink.nodes[].reconnect.delay`                    | The delay in milliseconds between reconnect attempts for this node.                                                                                                                                                                                                                                                                                               | ❌                                                         | `8.0.0`       |
| `lavalink.nodes[].reconnect.tries`                    | The number of times to attempt to reconnect to this node.                                                                                                                                                                                                                                                                                                         | ❌                                                         | `8.0.0`       |
| `features.autolyrics`                                 | Auto Lyrics feature: Allows users to toggle Quaver automatically sending lyrics for the current song.                                                                                                                                                                                                                                                             | ✅                                                         | `6.7.0`       |
| `features.autolyrics.enabled`                         | Whether the feature is enabled.                                                                                                                                                                                                                                                                                                                                   | ✅                                                         | `6.7.0`       |
| `features.autolyrics.whitelist`                       | Whether the feature requires guilds to be whitelisted. You will be able to whitelist guilds through the terminal.                                                                                                                                                                                                                                                 | ✅ (if feature is enabled)<br />❌ (if feature is disabled) | `6.7.0`       |
| `features.autolyrics.premium`                         | Whether to display the "requires premium" message when a guild is not whitelisted. Has no effect if `features.autolyrics.whitelist` is `false` or `premiumEnabled` is `false`.                                                                                                                                                                                    | ✅ (if feature is enabled)<br />❌ (if feature is disabled) | `6.7.0`       |
| `features.stay`                                       | 24/7 feature: Allows users to make Quaver stay in their voice channel regardless of activity.                                                                                                                                                                                                                                                                     | ✅                                                         |               |
| `features.stay.enabled`                               | Whether the feature is enabled.                                                                                                                                                                                                                                                                                                                                   | ✅                                                         |               |
| `features.stay.whitelist`                             | Whether the feature requires guilds to be whitelisted. You will be able to whitelist guilds through the terminal.                                                                                                                                                                                                                                                 | ✅ (if feature is enabled)<br />❌ (if feature is disabled) |               |
| `features.stay.premium`                               | Whether to display the "requires premium" message when a guild is not whitelisted. Has no effect if `features.stay.whitelist` is `false` or `premiumEnabled` is `false`.                                                                                                                                                                                          | ✅ (if feature is enabled)<br />❌ (if feature is disabled) | `6.7.0`       |
| `features.smartqueue`                                 | Smart Queue feature: Allows users to toggle fair queue sorting, alternating between songs from multiple requesters.                                                                                                                                                                                                                                               | ✅                                                         | `6.8.0`       |
| `features.smartqueue.enabled`                         | Whether the feature is enabled.                                                                                                                                                                                                                                                                                                                                   | ✅                                                         | `6.8.0`       |
| `features.smartqueue.whitelist`                       | Whether the feature requires guilds to be whitelisted. You will be able to whitelist guilds through the terminal.                                                                                                                                                                                                                                                 | ✅ (if feature is enabled)<br />❌ (if feature is disabled) | `6.8.0`       |
| `features.smartqueue.premium`                         | Whether to display the "requires premium" message when a guild is not whitelisted. Has no effect if `features.smartqueue.whitelist` is `false` or `premiumEnabled` is `false`.                                                                                                                                                                                    | ✅ (if feature is enabled)<br />❌ (if feature is disabled) | `6.8.0`       |
| `features.web`                                        | Web feature: Allows Quaver to handle Socket.IO connections from Quaver-Web.                                                                                                                                                                                                                                                                                       | ✅                                                         |               |
| `features.web.enabled`                                | Whether the feature is enabled.                                                                                                                                                                                                                                                                                                                                   | ✅                                                         |               |
| `features.web.port`                                   | The port to listen on for Socket.IO connections.                                                                                                                                                                                                                                                                                                                  | ✅ (if feature is enabled)<br />❌ (if feature is disabled) |               |
| `features.web.allowedOrigins`                         | The allowed origins for Socket.IO connections.                                                                                                                                                                                                                                                                                                                    | ✅ (if feature is enabled)<br />❌ (if feature is disabled) |               |
| `features.web.encryptionKey`                          | A random encryption key used to secure access tokens.                                                                                                                                                                                                                                                                                                             | ✅ (if feature is enabled)<br />❌ (if feature is disabled) |               |
| `features.web.apiSecret`                              | A secure random string used to authorize requests from your payment webhook receiver to `/api/premium/whitelist`.                                                                                                                                                                                                                                                 | ❌ (defaults to none)                                      | `8.0.0`       |
| `features.web.https`                                  | HTTPS configuration.                                                                                                                                                                                                                                                                                                                                              | ✅                                                         |               |
| `features.web.https.enabled`                          | Whether HTTPS is enabled.                                                                                                                                                                                                                                                                                                                                         | ✅                                                         | `6.0.0`       |
| `features.web.https.key`                              | The path to the HTTPS key file. This is relative to the root folder.                                                                                                                                                                                                                                                                                              | ✅ (if HTTPS is enabled)<br />❌ (if HTTPS is disabled)     | `6.0.0`       |
| `features.web.https.cert`                             | The path to the HTTPS certificate file. This is relative to the root folder.                                                                                                                                                                                                                                                                                      | ✅ (if HTTPS is enabled)<br />❌ (if HTTPS is disabled)     | `6.0.0`       |
| `features.web.dashboardURL`                           | The URL to the dashboard. If provided, this will be included at the bottom of the Now playing message as a button.                                                                                                                                                                                                                                                | ❌                                                         | `6.4.0`       |
| `updater.user`                                        | GitHub username of the user to check for updates from.                                                                                                                                                                                                                                                                                                            | ❌ (defaults to `ZPTXDev`)                                 | `8.0.0`       |
| `updater.repo`                                        | GitHub repository name to check for updates from.                                                                                                                                                                                                                                                                                                                 | ❌ (defaults to `Quaver`)                                  | `8.0.0`       |
| `updater.token`                                       | GitHub token to use for update checks. This is only necessary if you want to check for updates from a private repository, or if you want to increase the rate limit for update checks.                                                                                                                                                                            | ❌ (defaults to no token)                                  | `8.0.0`       |
| `updater.channel`                                     | The channel to use for update checks. Valid values are `none`, `stable`, `staging`, `next`.                                                                                                                                                                                                                                                                       | ❌ (defaults to `none`)                                    | `8.0.0`       |
| `updater.install`                                     | Whether to automatically download and install updates when found. Only used if `updater.channel` is not `none`.                                                                                                                                                                                                                                                   | ❌ (defaults to `false`)                                   | `8.0.0`       |
| `updater.restartStrategy`                             | The strategy to use when restarting Quaver after an update is installed. Only used if `updater.install` is set to `true` and `updater.channel` is not `none`. Valid values are `none` (no restart), `immediate`, `track` (after all players finish their current track, or up to 5 minutes), `queue` (after all players finish their queue, or up to 30 minutes). | ❌ (defaults to `none`)                                    | `8.0.0`       |
| `sessionRecovery.enabled`                             | Whether to enable resuming sessions after Quaver restarts. Enabling this will create a `states.json` file whenever Quaver shuts down.                                                                                                                                                                                                                             | ❌ (defaults to `false`)                                   | `8.0.0`       |
| `sessionRecovery.maxAge`                              | The maximum age of a session in seconds. Only used if `sessionRecovery.enabled` is `true`.                                                                                                                                                                                                                                                                        | ❌ (defaults to `86400` (24 hours))                        | `8.0.0`       |
| `sessionRecovery.maxAttempts`                         | The maximum number of attempts to resume a session. Only used if `sessionRecovery.enabled` is `true`.                                                                                                                                                                                                                                                             | ❌ (defaults to `1`)                                       | `8.0.0`       |
| `connectionHealth`                                    | Connection health monitoring configuration. Monitors Discord gateway and media server connectivity to detect and alert users about connection issues.                                                                                                                                                                                                             | ❌                                                         | `8.0.0`       |
| `connectionHealth.gateway.unstablePingThresholdMs`    | The ping threshold in milliseconds above which the gateway connection is considered unstable.                                                                                                                                                                                                                                                                     | ❌ (defaults to `500`)                                     | `8.0.0`       |
| `connectionHealth.gateway.unstableReconnectThreshold` | The number of reconnects within the sample window that indicates an unstable gateway connection.                                                                                                                                                                                                                                                                  | ❌ (defaults to `5`)                                       | `8.0.0`       |
| `connectionHealth.gateway.sampleIntervalSeconds`      | How often (in seconds) to sample gateway health metrics.                                                                                                                                                                                                                                                                                                          | ❌ (defaults to `10`)                                      | `8.0.0`       |
| `connectionHealth.gateway.sampleWindowSize`           | The number of samples to keep in the rolling window for gateway health analysis.                                                                                                                                                                                                                                                                                  | ❌ (defaults to `20`)                                      | `8.0.0`       |
| `connectionHealth.media.checkIntervalSeconds`         | How often (in seconds) to check Discord media server connectivity.                                                                                                                                                                                                                                                                                                | ❌ (defaults to `60`)                                      | `8.0.0`       |
| `connectionHealth.media.unstableLatencyMs`            | The latency threshold in milliseconds above which the media server connection is considered unstable.                                                                                                                                                                                                                                                             | ❌ (defaults to `2000`)                                    | `8.0.0`       |
| `connectionHealth.media.consecutiveFailureThreshold`  | The number of consecutive failed media server checks that triggers an unstable status alert.                                                                                                                                                                                                                                                                      | ❌ (defaults to `3`)                                       | `8.0.0`       |
| `connectionHealth.media.checkTimeoutMs`               | The timeout in milliseconds for media server health checks.                                                                                                                                                                                                                                                                                                       | ❌ (defaults to `2000`)                                    | `8.0.0`       |
| `ads.enabled`                                         | Whether to enable ad breaks for non-premium servers. When enabled, ads will play after the configured interval.                                                                                                                                                                                                                                                   | ❌ (defaults to `false`)                                   | `8.0.0`       |
| `ads.urls`                                            | An array of URLs linking to audio files that will be used as ads. Ads are selected randomly from this array. Only used if `ads.enabled` is `true`.                                                                                                                                                                                                                | ❌ (defaults to `[]`)                                      | `8.0.0`       |
| `ads.intervalMinutes`                                 | The interval in minutes between ad breaks. Ads will play after this amount of music playtime has elapsed (after a track ends). Only used if `ads.enabled` is `true`.                                                                                                                                                                                              | ❌ (defaults to `60`)                                      | `8.0.0`       |
