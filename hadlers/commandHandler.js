const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");
require("dotenv").config();

module.exports = (client) => {
  const commands = [];
  const foldersPath = path.join(__dirname, "../commands");
  const commandFolders = fs.readdirSync(foldersPath);

  for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(`${foldersPath}/${folder}`).filter(file => file.endsWith(".js"));
    for (const file of commandFiles) {
      const command = require(`${foldersPath}/${folder}/${file}`);
      if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
      }
    }
  }

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  (async () => {
    try {
      console.log("⏳ Refreshing application commands...");
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log("✅ Slash commands registered successfully!");
    } catch (error) {
      console.error("❌ Failed to register commands:", error);
    }
  })();
};
