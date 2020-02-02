const Discord = require('discord.js');
const express = require('express');
const fs = require('fs-extra');
const googleSpeech = require('@google-cloud/speech');
const http = require('http').createServer(express);
const io = require('socket.io')(http);
const path = require('path');
const { Readable, Transform } = require('stream');

// Configuration file that must be in JSON format
const { prefix, outputSocketPort, token } = require('./config.json');

// Client
const client = new Discord.Client();
// Google Speech Client for Speech to Text
const googleSpeechClient = new googleSpeech.SpeechClient();
// Output Path
const outputPath = path.join(__dirname, 'output');
// This is a hack that sent a silence frame so that we can keep the bot on
const silenceFrame = Buffer.from([0xF8, 0xFF, 0xFE]);

// Chat channel cache
var chatChannel = null;
// Voice channel cache
var voiceChannel = null;
// Radio cache
var radios = new Map();

class Silence extends Readable {
    _read() {
        this.push(silenceFrame);
    }
}

class ConvertTo1ChannelStream extends Transform {
    constructor(source, options) {
      super(options)
    }
    _transform(data, encoding, next) {
      next(null, convertBufferTo1Channel(data))
    }
  }

function convertBufferTo1Channel(buffer) {
    const convertedBuffer = Buffer.alloc(buffer.length / 2);
  
    for (let i = 0; i < convertedBuffer.length / 2; i++) {
      const uint16 = buffer.readUInt16LE(i * 4);
      convertedBuffer.writeUInt16LE(uint16, i * 2);
    }
  
    return convertedBuffer;
}

function startRecording(member, radio) {
    const connection = radio.connection;
    const receiver = connection.receiver;

    const voiceStream = receiver.createStream(member, { mode: 'pcm' });

    const requestConfig = {
        encoding: 'LINEAR16',
        sampleRateHertz: 48000,
        languageCode: 'en-US'
    }
    const request = {
        config: requestConfig
    }
    const recognizeStream = googleSpeechClient
        .streamingRecognize(request)
        .on('error', console.error)
        .on('data', response => {
            const transcription = response.results
                .map(result => result.alternatives[0].transcript)
                .join('\n')
                .toLowerCase()
            console.log(`${member.tag}: ${transcription}`);
            io.emit('message', `${member.tag}: ${transcription}`);
            radio.chatChannel.send(`${member.tag}: ${transcription}`);
    });

    const convertTo1ChannelStream = new ConvertTo1ChannelStream();
    voiceStream.pipe(convertTo1ChannelStream).pipe(recognizeStream);

    radio.members.set(member.id, {
        voiceStream
    });
    voiceStream.on('close', () => {
        radio.members.delete(member.id);
    }); 

    /* const output = path.join(radio.output, `${member.id}-${Date.now()}.raw_voice`);
    const writeStream = fs.createWriteStream(output);
    voiceStream.pipe(writeStream);
    radio.members.set(member.id, {
        voiceStream,
        writeStream
    });
    voiceStream.on('close', () => {
        radio.members.delete(member.id);
        writeStream.end();
    }); */
}

function stopRecording(member, radio) {
    const memberData = radio.members.get(member.id);
    if (memberData) {
        const { voiceStream } = memberData;
        voiceStream.destroy();
    }
    /* if (memberData) {
        const { voiceStream, writeStream } = memberData;
        voiceStream.destroy();
        writeStream.end();
    } */
    radio.members.delete(member.id);
}

// Ready event
client.on('ready', async () => {
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
                                const connection = await voiceChannel.join().then(async connection =>{
                                    msg.reply(`Ready to transmit in ${chatChannel.name}!`);
                                    console.log('Activated!');
                                    connection.play(new Silence(), { type: 'opus' });
                                    connection.on('speaking', (user, speaking) => {
                                        if (user, speaking) {
                                            console.log(user.tag + ' is speaking!');
                                            const radio = {
                                                name: voiceChannel.name,
                                                output,
                                                connection,
                                                chatChannel,
                                                members: new Map()
                                            };
                                            radios.set(voiceChannel.channelID, radio);
                                            if (user.id != client.user.id) {
                                                startRecording(user, radio);
                                            }
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

http.listen(outputSocketPort, function () {
    console.log(`Output listening on *:${outputSocketPort}`);
});

client.login(token);