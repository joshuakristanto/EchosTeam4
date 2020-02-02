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

# Requirements:
* Google Cloud Account
* Discord Account

# How to use:
1. Turn bot services on
2. Join voice channel
3. Type ``<prefix>activate <channel>``
4. Clients can use Electron
5. Speak

# How to Configure:
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