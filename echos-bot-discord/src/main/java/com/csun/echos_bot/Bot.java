package com.csun.echos_bot;

import discord4j.core.DiscordClient;
import discord4j.core.DiscordClientBuilder;
import discord4j.core.event.domain.lifecycle.ReadyEvent;
import discord4j.core.event.domain.message.MessageCreateEvent;
import discord4j.core.object.entity.Message;
import java.io.File;
import java.io.FileNotFoundException;
import java.util.Scanner;

public class Bot {
	private String discordToken = "";
	
	protected void run() {
		// Get our bot token
	    final File tokenFile = new File("token.txt");
	    Scanner tokenScanner;
		try {
			tokenScanner = new Scanner(tokenFile);
			if (tokenScanner.hasNextLine()) {
				discordToken = tokenScanner.nextLine(); 
			}
			System.out.println("Bot starting with token: " + discordToken);
			tokenScanner.close();
		}
		catch (FileNotFoundException e) {
			e.printStackTrace();
		}

		final DiscordClient client = new DiscordClientBuilder(discordToken).build();

		client.getEventDispatcher().on(ReadyEvent.class)
		        .subscribe(ready -> System.out.println("Logged in as " + ready.getSelf().getUsername()));

		client.getEventDispatcher().on(MessageCreateEvent.class)
		        .map(MessageCreateEvent::getMessage)
		        .filter(msg -> msg.getContent().map("!ping"::equals).orElse(false))
		        .flatMap(Message::getChannel)
		        .flatMap(channel -> channel.createMessage("Pong!"))
		        .subscribe();

		client.login().block();
	}
}
