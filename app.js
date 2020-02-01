const Discord = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
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

var radios = new Map();

async function startRecording(member, radio) {
    console.log('Activated with no errors so far!');
    const connection = radio.connection;
    const receiver = connection.receiver;
    connection.on('speaking', (user, speaking) => {
        if (speaking) {
            console.log('User ' + user.tag + ' speaking!');
        }
    })
    const voiceStream = receiver.createStream(member, { mode: 'opus', end: 'manual' });
    const output = path.join(radio.output, `${member.id}-${Date.now()}.raw_opus`);
    const writeStream = fs.createWriteStream(output);
    voiceStream.pipe(writeStream);
    radio.members.set(member.id, {
        voiceStream,
        writeStream
    });
    voiceStream.on('close', () => {
        radio.members.delete(member.id);
        writeStream.end();
    });
}

async function stopRecording(member, radio) {
    const memberData = radio.members.get(member.id);
    if (memberData) {
        const { voiceStream, writeStream } = memberData;
        voiceStream.destroy();
        writeStream.end();
    }
    radio.members.delete(member.id);
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
            console.log('Was pinged!');
        }
        else if (command === 'activate') { // Activate recording command
            if (args[0]) {
                chatChannel = client.channels.find(channel => channel.name === args[0]);
                if (chatChannel) {
                    if (!voiceChannel) {
                        const voice = member.voice;
                        if (voice) {
                            voiceChannel = voice.channel;
                            if (voiceChannel) {
                                const output = path.join(outputPath, `${voiceChannel.channelID}-${Date.now()}`);
                                fs.ensureDir(output);
                                voiceChannel.join().then(connection => {
                                    msg.reply(`Ready to transmit in ${chatChannel.name}!`);
            
                                    const radio = {
                                        name: voiceChannel.name,
                                        output,
                                        connection,
                                        members: new Map()
                                    };
                                    radios.set(voiceChannel.channelID, radio);
                                    voiceChannel.members.forEach((member) => {
                                        if (member.user != client.user) {
                                            startRecording(member, radio);
                                        }
                                    });
                                });
                            }
                            else {
                                msg.reply('Could not use the voice channel!');
                            }
                        }
                        else {
                            msg.reply('Could not get the voice state!');
                        }
                    }
                    else {
                        msg.reply('Voice channel was already specified, please deactivate!');
                    }
                }
                else {
                    msg.reply('Could not use the chat channel!');
                }
            }
            else {
                msg.reply('Please specify a channel!');
            }
        }
        else if (command === 'deactivate') { // Deactivate recording command
            chatChannel = null;
            if (voiceChannel) {
                msg.reply('No longer ready to transmit!');
                const radio = radios.get(voiceChannel.channelID);
                radio.members.forEach((member) => {
                    stopRecording(member, radio);
                });
                voiceChannel.leave();
            }
            voiceChannel = null;
            console.log(`Deactivating!`);
        }
    }
});

client.login(token);