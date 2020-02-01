package com.csun.echos_bot;

public class App {
	private Bot bot = new Bot();
	
	public static void main(String[] args) {
		final App app = new App();
		app.run();
	}
	
	private void run() {
		bot.run();
	}
}