# SilverRain

SilverRain is a Discord music bot built with Node.js, `discord.js`, `@discordjs/voice`, `play-dl`, and `yt-dlp`. It can join a voice channel, stream tracks from YouTube or SoundCloud, adjust playback volume, and send optional welcome messages to new members.

## Features

- Play music from a search query or direct URL with `!play`
- Stream audio in voice channels
- Control playback volume with `!volume`
- Send welcome messages when members join a server
- Fall back to SoundCloud if YouTube is blocked for the host IP

## Commands

- `!play <song name or YouTube URL>` - start playing a track in your current voice channel
- `!volume <0-5>` - set the current playback volume
- `!testwelcome` - test the welcome message flow when welcome messages are enabled

## Requirements

- Node.js
- A Discord bot token
- `yt-dlp` installed and available on your `PATH`
- A Discord application configured with the needed intents

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root and add your configuration.

3. Start the bot:

```bash
npm start
```

## Environment Variables

- `DISCORD_TOKEN` - required. Your Discord bot token.
- `ENABLE_WELCOME` - set to `true` to enable welcome messages.
- `ENABLE_MESSAGE_CONTENT` - set to `false` only if you do not want the message content intent.
- `WELCOME_CHANNEL_ID` - optional channel ID for welcome messages.
- `YTDLP_COOKIES_PATH` - optional path to exported YouTube cookies for blocked regions or IPs.
- `YTDLP_USER_AGENT` - optional user agent string for `yt-dlp`.

## Notes

- If YouTube returns a bot-check or blocks the server IP, SilverRain will try a SoundCloud fallback for non-URL searches.
- The bot uses prefix-based commands, so the message content intent must be enabled if you want `!play`, `!volume`, and `!testwelcome` to work.