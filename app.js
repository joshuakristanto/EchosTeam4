const Discord = require('discord.js');
const fs = require('fs');

// Configuration file that must be in JSON format
const { prefix, token } = require('./config.json');
// Client
const client = new Discord.Client();

// Chat channel cache
var chatChannel = null;
// Voice channel cache
var voiceChannel = null;

function generateOutputFile(channel, member) {
    const fileName = './recordings/${channel.id}-${member.id}-${Date.now()}.pcm';
    return fs.createWriteStream(fileName);
  }

// Ready event
client.on('ready', () => {
    console.log('Logged in as ${client.user.tag}!');
});

// Message event
client.on('message', msg => {
    if (msg.content.startsWith(prefix) && !msg.author.bot) {
        const args = msg.content.slice(prefix.length).split(' '); // Arguments of a message
        const command = args.shift().toLowerCase(); // Command
    
        if (command === 'ping') { // Test command
            msg.reply('Pong!');
        }
        else if (command === 'activate') { // Activate recording command
            voiceChannel = msg.member.voiceChannel
            if (args[0]) {
                chatChannel = client.channels.find('name', args[0]);
            }
            if (chatChannel) {
                chatChannel.send('test');
            }
            if (voiceChannel) {
                voiceChannel.join().then(conn => {
                    msg.reply('ready!');
                    // create our voice receiver
                    const receiver = conn.createReceiver();
            
                    conn.on('speaking', (user, speaking) => {
                      if (speaking) {
                        msg.channel.sendmsg('I\'m listening to ${user}');
                        // this creates a 16-bit signed PCM, stereo 48KHz PCM stream.
                        const audioStream = receiver.createPCMStream(user);
                        // create an output stream so we can dump our data in a file
                        const outputStream = generateOutputFile(voiceChannel, user);
                        // pipe our audio data into the file stream
                        audioStream.pipe(outputStream);
                        outputStream.on("data", console.log);
                        // when the stream ends (the user stopped talking) tell the user
                        audioStream.on('end', () => {
                          msg.channel.sendmsg('I\'m no longer listening to ${user}');
                        });
                      }
                    });
                  })
            }
        }
        else if (command === 'deactivate') { // Deactivate recording command
            if (voiceChannel) {
                voiceChannel.leave();
                voiceChannel = null;
            }
        }
    }
});

client.login(token);