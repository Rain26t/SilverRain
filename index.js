const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus 
} = require('@discordjs/voice');
const play = require('play-dl');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
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

player.on(AudioPlayerStatus.Idle, () => {
  currentResource = null;
});

player.on('error', (error) => {
  console.error('Audio player error:', error.message);
});

async function resolveTrack(query) {
  const validation = play.yt_validate(query);

  if (validation === 'video') {
    const info = await play.video_info(query);
    return {
      url: query,
      title: info.video_details.title,
    };
  }

  const results = await play.search(query, { limit: 1 });
  if (!results.length) {
    throw new Error('No song found for your query.');
  }

  return {
    url: results[0].url,
    title: results[0].title,
  };
}

client.on('ready', () => {
  console.log("Music bot with volume is online!");
});

client.on('guildMemberAdd', async (member) => {
  try {
    const me = member.guild.members.me;
    const systemChannel = member.guild.systemChannel;
    const canUseSystemChannel =
      systemChannel &&
      me &&
      systemChannel.permissionsFor(me).has(PermissionsBitField.Flags.SendMessages);

    const fallbackChannel = member.guild.channels.cache.find((channel) => {
      if (!channel.isTextBased() || channel.isDMBased()) {
        return false;
      }

      return (
        /(welcome|general)/i.test(channel.name) &&
        me &&
        channel.permissionsFor(me).has(PermissionsBitField.Flags.SendMessages)
      );
    });

    const targetChannel = canUseSystemChannel ? systemChannel : fallbackChannel;
    const welcomeMessage = `Welcome ${member} to **${member.guild.name}**!`;

    if (targetChannel) {
      await targetChannel.send(welcomeMessage);
      return;
    }

    await member.send(`Welcome to ${member.guild.name}!`);
  } catch (error) {
    console.error('Welcome message failed:', error.message);
  }
});

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
      });

      const track = await resolveTrack(query);
      const stream = await play.stream(track.url);

      currentResource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true
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
  } catch (error) {
    console.error('messageCreate handler error:', error);
  }
});

client.login(TOKEN).catch((error) => {
  console.error('Discord login failed:', error.message);
});



