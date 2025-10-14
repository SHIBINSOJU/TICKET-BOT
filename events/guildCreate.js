const fs = require("fs");
const { REST, Routes } = require("@discordjs/rest");

module.exports = {
  name: "guildCreate",
  async execute(guild, client) {
    console.log(`➡️ Joined new guild: ${guild.name} (${guild.id})`);

    // Deploy commands to the new guild instantly
    const commandFiles = fs.readdirSync("./commands").flatMap(dir =>
      fs.readdirSync(`./commands/${dir}`).filter(f => f.endsWith(".js")).map(f => `./commands/${dir}/${f}`)
    );

    const commands = commandFiles.map(f => require(f).data.toJSON());

    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

    try {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id), { body: commands });
      console.log(`✅ Commands deployed to guild: ${guild.name}`);
    } catch (err) {
      console.error(`❌ Failed to deploy commands to guild: ${guild.name}`, err);
    }
  },
};
