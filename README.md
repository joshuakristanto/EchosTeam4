# EchosTeam4
[![EchosTeam4](Echos.png)](https://github.com/joshuakristanto/EchosTeam4/)

# Objective:
Create a Bot that monitors a Voice Channel and utilizes
a speech-to-text engine/service to caption voice chat
for Deaf & Hard of Hearing. May be able to utilize
Discord’s overlay as the surface to display captions on.

# Tools:
* NPM + Node.js
* Electron
* Socket.io
* FFMPEG
* Jquery
* Google Speech To Text

# How to use:
1. Join voice channel
2. Type <prefix>activate <channel>
3. Clients activate Electron
4. Speak

# How to configure:
You need a config.json with the following:
```
{
    "prefix": "...",
    "outputSocketPort": "...",
    "token": "..."
}
```

# Testing
The bot was tested as much as possible to get the best user experience.
The bot was able to recognize most voices.

# Future Work:
* Work on improving speech recognition
* Use machine learning for better text results
* Improve overlay design