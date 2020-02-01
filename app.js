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
    const fileName = `./recordings/${channel.id}-${member.id}-${Date.now()}.pcm`;
    return fs.createWriteStream(fileName);
}

// Ready event
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Message event
client.on('message', async (msg) => {
    if (msg.content.startsWith(prefix) && !msg.author.bot) {
        const args = msg.content.slice(prefix.length).split(' '); // Arguments of a message
        const command = args.shift().toLowerCase(); // Command
    
        if (command === 'ping') { // Test command
            msg.reply('Pong!');
        }
        else if (command === 'activate') { // Activate recording command
            if (!voiceChannel) {
                voiceChannel = msg.member.voiceChannel
                if (args[0]) {
                    chatChannel = client.channels.find(channel => channel.name === args[0]);
                    if (voiceChannel && chatChannel) {
                        var voiceChannelConnection = await voiceChannel.join();
                        msg.reply(`Ready to transmit in ${chatChannel.name}!`);
                        voiceChannelConnection.on('speaking', (user, speaking) => {
                            if (speaking) {
                                console.log(`I'm listening to ${user.username}`)
                            }
                            else {
                                console.log(`I stopped listening to ${user.username}`)
                            }
                        })
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
                voiceChannel.leave();
            }
            voiceChannel = null;
        }
    }
});

client.login(token);