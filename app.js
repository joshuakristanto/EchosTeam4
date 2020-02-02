const Discord = require('discord.js');
const express = require('express');
const fs = require('fs-extra');
const googleSpeech = require('@google-cloud/speech');
const http = require('http').createServer(express);
const io = require('socket.io')(http);
const path = require('path');
const { Readable, Transform } = require('stream');

// Configuration file that must be in JSON format
// with a prefix, outputSocketPort, and your token
const { prefix, outputSocketPort, token } = require('./config.json');

// Client
const client = new Discord.Client();
// Google Speech to Text which requires you to set up a Google API key
// in your PATH system variables
const googleSpeechClient = new googleSpeech.SpeechClient();
// Output path
const outputPath = path.join(__dirname, 'output');
// Silent frame
const silenceFrame = Buffer.from([0xF8, 0xFF, 0xFE]);
// Streaming text limit
const streamingLimit = 290000;

// Bridging text offset
var bridgingOffset = 0;
// Chat channel cache
var chatChannel = null;
// Voice channel cache
var voiceChannel = null;
// Radio cache
var radios = new Map();
// Resulting end time for text
var resultEndTime = 0;

// Silence object class for a silent frame to keep bot alive
class Silence extends Readable {
    _read() {
        this.push(silenceFrame);
    }
}

// Converts from n-channel to 1 channel for audio processing for
// compatbility for Google
class ConvertTo1ChannelStream extends Transform {
    constructor(source, options) {
      super(options)
    }
    _transform(data, encoding, next) {
      next(null, convertBufferTo1Channel(data))
    }
}

// Converts from n-buffer to 1 channel for audio processing for
// compatibility for Google
/** @return {Buffer} */
function convertBufferTo1Channel(buffer) {
    const convertedBuffer = Buffer.alloc(buffer.length / 2);
  
    for (let i = 0; i < convertedBuffer.length / 2; i++) {
      const uint16 = buffer.readUInt16LE(i * 4);
      convertedBuffer.writeUInt16LE(uint16, i * 2);
    }
  
    return convertedBuffer;
}

// Recording function for streaming
function startRecording(member, radio) {
    // Connection to voice channel
    const connection = radio.connection;
    // Voice reciever for the connection
    const receiver = connection.receiver;

    // Create a stream for the voice reciever of the voice channel
    const voiceStream = receiver.createStream(member, { mode: 'pcm' });

    // Configiuration for streaming for proper audio quality
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
        .on('data', (stream) => {
            // Convert API result end time from seconds + nanoseconds to milliseconds
            resultEndTime = stream.results[0].resultEndTime.seconds * 1000 +
                Math.round(stream.results[0].resultEndTime.nanos / 1000000);
        
            // Calculate correct time based on offset from audio sent twice
            const correctedTime = resultEndTime - bridgingOffset + streamingLimit;
        
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            let stdoutText = '';
            if (stream.results[0] && stream.results[0].alternatives[0]) {
                stdoutText = correctedTime + ': ' + stream.results[0].alternatives[0].transcript;
            }
        
            if (stream.results[0].isFinal) {
                // process.stdout.write(`${stdoutText}\n`);
                let transcript = stream.results[0].alternatives[0].transcript;
                // Send data to socket client
                console.log(`${member.tag}: ${transcript}`);
                io.emit('message', `${member.tag}: ${transcript}`);
                radio.chatChannel.send(`${member.tag}: ${transcript}`);
        
                isFinalEndTime = 0;
            }
            else {
                // Make sure transcript does not exceed console character length
                if (stdoutText.length > process.stdout.columns) {
                    stdoutText = stdoutText.substring(0, process.stdout.columns - 4) + '...';
                }
                // process.stdout.write(`${stdoutText}`);
            }
        });
        /*.on('data', response => {
            const transcription = response.results
                .map(result => result.alternatives[0].transcript)
                .join('\n')
                .toLowerCase()
            
            console.log(`${member.tag}: ${transcription}`);
            io.emit('message', `${member.tag}: ${transcription}`);
            radio.chatChannel.send(`${member.tag}: ${transcription}`);
    });*/

    // Conversion of stream for compatibility
    const convertTo1ChannelStream = new ConvertTo1ChannelStream();

    // Piping stream to functions and outputs
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

// Stop the recording of the stream
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
        // Arguments of a message so that message is split up
        const args = msg.content.slice(prefix.length).split(' ');
        // First element of message which is normally the command
        const command = args.shift().toLowerCase();
        // Member who specified the command
        const member = msg.member;
                        
        // Test command
        if (command === 'ping') {
            msg.reply('Pong!');
            console.log('Was pinged!');
        }
        // Activate recording command
        else if (command === 'activate') {
            if (args[0]) {
                // This gets the chat channel specified from the arguments of the activate
                // command
                chatChannel = client.channels.find(channel => channel.name === args[0]);
                if (chatChannel) {
                    // The bot must not be in an existing voice channel
                    if (!voiceChannel) {
                        // Voice state object of the member
                        const voice = member.voice;
                        if (voice) {
                            // Voice channel the member is in
                            voiceChannel = voice.channel;
                            // The member must be in an existing voice channel
                            if (voiceChannel) {
                                // This is for an output folder for streaming files
                                const output = path.join(outputPath, `${voiceChannel.channelID}-${Date.now()}`);
                                fs.ensureDir(output);
                                
                                // Connection processing
                                const connection = await voiceChannel.join().then(async connection =>{
                                    msg.reply(`Ready to transmit in ${chatChannel.name}!`);
                                    console.log('Activated!');
                                    // Silent frame to get bot working
                                    connection.play(new Silence(), { type: 'opus' });
                                    // Speaking event
                                    connection.on('speaking', (user, speaking) => {
                                        if (user) {
                                            if (speaking) {
                                                console.log(user.tag + ' is speaking!');
                                                const radio = {
                                                    name: voiceChannel.name,
                                                    output,
                                                    connection,
                                                    chatChannel,
                                                    members: new Map()
                                                };
                                                radios.set(voiceChannel.channelID, radio);

                                                // The user speaking should not be the bot
                                                if (user.id != client.user.id) {
                                                    startRecording(user, radio);
                                                }
                                            }
                                            else {
                                                // Silent frame when there is no activity to keep alive
                                                connection.play(new Silence(), { type: 'opus' });
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
        // Deactivate recording command
        /*else if (command === 'deactivate') {
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
        }*/
    }
});

// Listen on specified socket port to send the bot messages to said port
http.listen(outputSocketPort, function () {
    console.log(`Output listening on *:${outputSocketPort}`);
});

// Login to Discord bot
client.login(token);