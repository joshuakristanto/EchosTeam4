const Discord = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const { Readable } = require('stream');
// Configuration file that must be in JSON format
const { prefix, token } = require('./config.json');

// Client
const client = new Discord.Client();
// Output Path
const outputPath = path.join(__dirname, 'output');

// Chat channel cache
var chatChannel = null;
// Voice channel cache
var voiceChannel = null;

var podcasts = new Map();

var writeStream = null;

class Silence extends Readable {
    _read() {
      this.push(Buffer.from([0xF8, 0xFF, 0xFE]));
    }
  }

function startRecording(member, podcast, msg) {
    const connection = podcast.voiceConnection;
    const receiver = connection.createReceiver();
    receiver.on('pcm', () => { console.log('a'); });
    connection.on('speaking', (user, speaking) => {
        if (speaking) {
            console.log('1');
        }
        if (!speaking) {
            console.log('2');
        }
    })
    const voiceStream = receiver.createPCMStream(member);
    const output = path.join(podcast.output, `${member.id}-${Date.now()}.raw_pcm`);
    const writeStream = fs.createWriteStream(output);
    voiceStream.pipe(writeStream);
    podcast.members.set(member.id, {
        voiceStream,
        writeStream
    });
    voiceStream.on('close', () => {
        console.log('end of recording voice!');
        podcast.members.delete(member.id);
        writeStream.end(err => {
            if (err) {
                log.error(err);
            }
        });
    });
}

function stopRecording(member, podcast) {
    const memberData = podcast.members.get(member.id);
    if (memberData) {
        const { voiceStream, writeStream } = memberData;
        voiceStream.destroy();
        writeStream.end();
    }
    podcast.members.delete(member.id);
}

// Ready event
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Message event
client.on('message', async (msg) => {
    if (msg.content.startsWith(prefix) && !msg.author.bot) {
        const args = msg.content.slice(prefix.length).split(' '); // Arguments of a message
        const command = args.shift().toLowerCase(); // First element of message
        const member = msg.member; // Member who specified the message
                        
        if (command === 'ping') { // Test command
            msg.reply('Pong!');
        }
        else if (command === 'activate') { // Activate recording command
            if (!voiceChannel) {
                voiceChannel = member.voiceChannel;
                if (args[0]) {
                    chatChannel = client.channels.find(channel => channel.name === args[0]);
                    if (voiceChannel && chatChannel) {
                        const output = path.join(outputPath, `${voiceChannel.channelID}-${Date.now()}`);
                            
                        const [voiceConnection] = await Promise.all([
                            voiceChannel.join(),
                            fs.ensureDir(output)
                        ]);
                        if (voiceConnection) {
                            msg.reply(`Ready to transmit in ${chatChannel.name}!`);
    
                            const podcast = {
                                name: voiceChannel.name,
                                output,
                                voiceConnection,
                                members: new Map()
                            };
                            voiceConnection.on('ready', ()=>{
                                console.log("test");
                                voiceConnection.play(new Silence(), { type: 'opus' });
                                })
                            podcasts.set(voiceChannel.channelID, podcast);
                            voiceChannel.members.forEach((member) => {
                                startRecording(member, podcast, msg);
                            });
                        }
                        else {
                            msg.reply('Could not use the voice channel!');
                        }
                    }
                    else {
                        msg.reply('Could not use the voice channel or chat channel!');
                    }
                }
                else {
                    msg.reply('Please specify a channel!');
                }
            }
            else {
                msg.reply('Voice channel was already specified, please deactivate!');
            }
        }
        else if (command === 'deactivate') { // Deactivate recording command
            chatChannel = null;
            if (voiceChannel) {
                msg.reply('No longer ready to transmit!');
                const podcast = podcasts.get(voiceChannel.channelID);
                podcast.members.forEach((member) => {
                    stopRecording(member, podcast);
                });
                voiceChannel.leave();
            }
            voiceChannel = null;
        }
    }
});

client.login(token);