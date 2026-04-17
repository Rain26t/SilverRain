const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus,
  entersState,
  demuxProbe,
} = require('@discordjs/voice');
const play = require('play-dl');

const ENABLE_WELCOME = process.env.ENABLE_WELCOME === 'true';
const ENABLE_MESSAGE_CONTENT = process.env.ENABLE_MESSAGE_CONTENT !== 'false';
const YTDLP_COOKIES_PATH = process.env.YTDLP_COOKIES_PATH || '';
const YTDLP_USER_AGENT = process.env.YTDLP_USER_AGENT || '';
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID || '';

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildVoiceStates,
];

if (ENABLE_WELCOME) {
  intents.push(GatewayIntentBits.GuildMembers);
}

if (ENABLE_MESSAGE_CONTENT) {
  intents.push(GatewayIntentBits.MessageContent);
}

const client = new Client({
  intents,
});

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN environment variable.');
  console.error(`Checked .env at: ${path.join(__dirname, '.env')}`);
  console.error(`Current working directory: ${process.cwd()}`);
  process.exit(1);
}

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

let player = createAudioPlayer();
let currentResource = null;
let soundCloudReady = false;

async function ensureSoundCloudReady() {
  if (soundCloudReady) {
    return;
  }

  const clientId = await play.getFreeClientID();
  play.setToken({
    soundcloud: {
      client_id: clientId,
    },
  });
  soundCloudReady = true;
}

player.on(AudioPlayerStatus.Idle, () => {
  currentResource = null;
});

player.on('error', (error) => {
  console.error('Audio player error:', error.message);
});

async function resolveTrack(query) {
  const isSoundCloudUrl = /soundcloud\.com/i.test(query);

  if (isSoundCloudUrl) {
    const soundcloudTrack = await play.soundcloud(query);
    return {
      source: 'soundcloud',
      url: query,
      title: soundcloudTrack.title,
    };
  }

  const target = play.yt_validate(query) === 'video' || query.startsWith('http')
    ? query
    : `ytsearch1:${query}`;

  const info = await runYtDlpJson(target);
  const normalized = info.entries?.[0] ?? info;

  return {
    source: 'youtube',
    target,
    title: normalized.title || 'YouTube track',
  };
}

async function resolveSoundCloudFallback(query) {
  await ensureSoundCloudReady();

  const results = await play.search(query, {
    limit: 1,
    source: { soundcloud: 'tracks' },
  });

  if (!results.length) {
    throw new Error('No SoundCloud fallback result found for your query.');
  }

  return {
    source: 'soundcloud',
    url: results[0].url,
    title: results[0].title || 'SoundCloud track',
  };
}

function runYtDlpJson(target) {
  return new Promise((resolve, reject) => {
    const ytDlp = spawn('yt-dlp', [
      '--no-playlist',
      '--skip-download',
      '--dump-single-json',
      '--no-warnings',
      '--quiet',
      ...buildYtDlpCommonArgs(),
      target,
    ]);

    let stdout = '';
    let stderr = '';

    ytDlp.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    ytDlp.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ytDlp.on('error', (error) => {
      reject(new Error(`yt-dlp is not available: ${error.message}`));
    });

    ytDlp.on('close', (code) => {
      if (code !== 0) {
        const errorText = stderr.trim() || `yt-dlp exited with code ${code}`;
        if (/sign in to confirm you\u2019re not a bot|sign in to confirm you're not a bot/i.test(errorText)) {
          reject(new Error('YouTube blocked this server IP. Configure YTDLP_COOKIES_PATH with exported YouTube cookies.'));
          return;
        }

        reject(new Error(errorText));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Could not parse yt-dlp output: ${error.message}`));
      }
    });
  });
}

function runYtDlpStream(target) {
  const ytDlp = spawn('yt-dlp', [
    '--no-playlist',
    '--no-warnings',
    '--quiet',
    ...buildYtDlpCommonArgs(),
    '-f', 'bestaudio[ext=webm]/bestaudio/best',
    '-o', '-',
    target,
  ]);

  ytDlp.on('error', (error) => {
    console.error('yt-dlp stream error:', error.message);
  });

  ytDlp.stderr.on('data', (chunk) => {
    const output = chunk.toString().trim();
    if (output) {
      console.error('yt-dlp:', output);
    }
  });

  return ytDlp;
}

function buildYtDlpCommonArgs() {
  const args = [
    '--extractor-args', 'youtube:player_client=android',
  ];

  if (YTDLP_COOKIES_PATH && fs.existsSync(YTDLP_COOKIES_PATH)) {
    args.push('--cookies', YTDLP_COOKIES_PATH);
  }

  if (YTDLP_USER_AGENT) {
    args.push('--user-agent', YTDLP_USER_AGENT);
  }

  return args;
}

function getWelcomeChannel(guild) {
  const me = guild.members.me;

  if (WELCOME_CHANNEL_ID) {
    const channel = guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (
      channel &&
      channel.isTextBased() &&
      !channel.isDMBased() &&
      me &&
      channel.permissionsFor(me).has(PermissionsBitField.Flags.SendMessages)
    ) {
      return channel;
    }
  }

  const systemChannel = guild.systemChannel;
  const canUseSystemChannel =
    systemChannel &&
    me &&
    systemChannel.permissionsFor(me).has(PermissionsBitField.Flags.SendMessages);

  if (canUseSystemChannel) {
    return systemChannel;
  }

  return guild.channels.cache.find((channel) => {
    if (!channel.isTextBased() || channel.isDMBased()) {
      return false;
    }

    return (
      /(welcome|general)/i.test(channel.name) &&
      me &&
      channel.permissionsFor(me).has(PermissionsBitField.Flags.SendMessages)
    );
  });
}

async function sendWelcomeMessage(member, isTest = false) {
  const targetChannel = getWelcomeChannel(member.guild);
  const content = isTest
    ? `Welcome test: SilverRain can send welcome messages for ${member}.`
    : `Welcome ${member} to **${member.guild.name}**!`;

  if (targetChannel) {
    await targetChannel.send(content);
    return;
  }

  if (!isTest) {
    await member.send(`Welcome to ${member.guild.name}!`);
  }
}

client.on('ready', () => {
  console.log("Music bot with volume is online!");
  if (!ENABLE_WELCOME) {
    console.log('Welcome messages are disabled. Set ENABLE_WELCOME=true to enable.');
  }
  if (!ENABLE_MESSAGE_CONTENT) {
    console.log('Message content intent is disabled. Prefix commands will not work.');
  }
});

if (ENABLE_WELCOME) {
  client.on('guildMemberAdd', async (member) => {
  try {
    await sendWelcomeMessage(member);
  } catch (error) {
    console.error('Welcome message failed:', error.message);
  }
  });
}

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot || !message.guild) return;

  // 🎵 PLAY COMMAND
    if (message.content.startsWith("!play")) {
    try {
      const query = message.content.replace("!play", "").trim();

      if (!query) {
        return message.reply("Usage: !play <song name or YouTube URL>");
      }

      if (!message.member.voice.channel) {
        return message.reply("Join a voice channel first!");
      }

      const connection = joinVoiceChannel({
        channelId: message.member.voice.channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

      let track;
      try {
        track = await resolveTrack(query);
      } catch (error) {
        const isUrl = query.startsWith('http');
        const isYouTubeBlocked = /YouTube blocked this server IP/i.test(error.message);

        if (!isUrl && isYouTubeBlocked) {
          try {
            track = await resolveSoundCloudFallback(query);
          } catch (fallbackError) {
            if (/client_id/i.test(fallbackError.message)) {
              soundCloudReady = false;
              track = await resolveSoundCloudFallback(query);
            } else {
              throw fallbackError;
            }
          }
          await message.reply('YouTube blocked this VPS IP. Trying SoundCloud fallback.');
        } else {
          throw error;
        }
      }

      let audioSource;
      if (track.source === 'youtube') {
        const ytDlpProcess = runYtDlpStream(track.target);
        audioSource = ytDlpProcess.stdout;
      } else {
        const soundcloudStream = await play.stream(track.url);
        audioSource = soundcloudStream.stream;
      }

      let resourceInput = audioSource;
      let resourceType = StreamType.Arbitrary;

      try {
        const probed = await demuxProbe(audioSource);
        resourceInput = probed.stream;
        resourceType = probed.type;
      } catch (probeError) {
        console.warn('demuxProbe fallback to arbitrary stream:', probeError.message);
      }

      currentResource = createAudioResource(resourceInput, {
        inputType: resourceType,
        inlineVolume: true,
      });
      currentResource.volume.setVolume(1);
      player.play(currentResource);
      connection.subscribe(player);

      message.reply(`Playing: ${track.title}`);
    } catch (error) {
      console.error('Play command failed:', error.message);
      message.reply(`Could not play that track: ${error.message}`);
    }
    }

    // 🔊 VOLUME COMMAND
    if (message.content.startsWith("!volume")) {
      if (!currentResource) {
        return message.reply("Nothing is playing.");
      }

      const vol = parseFloat(message.content.split(" ")[1]);

      if (isNaN(vol) || vol < 0 || vol > 5) {
        return message.reply("Enter volume between 0 and 5");
      }

      currentResource.volume.setVolume(vol);

      message.reply(`Volume set to ${vol * 100}%`);
    }

    if (message.content === '!testwelcome') {
      if (!ENABLE_WELCOME) {
        return message.reply('Welcome feature is disabled. Set ENABLE_WELCOME=true and restart.');
      }

      await sendWelcomeMessage(message.member, true);
      return message.reply('Welcome test sent.');
    }
  } catch (error) {
    console.error('messageCreate handler error:', error);
  }
});

client.login(TOKEN).catch((error) => {
  console.error('Discord login failed:', error.message);
  if (error.code === 'TokenInvalid') {
    console.error('DISCORD_TOKEN is invalid. Generate a new token in Discord Developer Portal.');
  }
  if (/disallowed intents/i.test(error.message)) {
    console.error('Enable required intents in Discord Developer Portal or disable flags in .env.');
  }
  process.exit(1);
});



