const { Client, GatewayIntentBits } = require('discord.js');
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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  throw new Error("Missing DISCORD_TOKEN environment variable.");
}

let player = createAudioPlayer();
let currentResource = null;

client.on('ready', () => {
  console.log("Music bot with volume is online!");
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // 🎵 PLAY COMMAND
  if (message.content.startsWith("!play")) {
    const query = message.content.replace("!play", "").trim();

    if (!message.member.voice.channel) {
      return message.reply("Join a voice channel first!");
    }

    const connection = joinVoiceChannel({
      channelId: message.member.voice.channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    const stream = await play.stream(query);

    currentResource = createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true   // 🔥 REQUIRED FOR VOLUME
    });

    currentResource.volume.setVolume(1); // default 100%

    player.play(currentResource);
    connection.subscribe(player);

    message.reply(`Playing: ${query}`);
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
});

client.login(TOKEN);



