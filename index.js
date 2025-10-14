require("dotenv").config();
const fs = require("fs");
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const mongoConnect = require("./utils/mongoConnect");
const { REST, Routes } = require("@discordjs/rest");

// ================== 1️⃣ Create Client ==================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.commands = new Collection();

// ================== 2️⃣ Load Commands ==================
const commandFiles = fs.readdirSync("./commands").flatMap(dir =>
  fs.readdirSync(`./commands/${dir}`).filter(f => f.endsWith(".js")).map(f => `./commands/${dir}/${f}`)
);

for (const file of commandFiles) {
  const command = require(file);
  client.commands.set(command.data.name, command);
}

// ================== 3️⃣ Load Events ==================
const eventFiles = fs.readdirSync("./events").filter(f => f.endsWith(".js"));
for (const file of eventFiles) {
  const event = require(`./events/${file}`);
  if (event.once) client.once(event.name, (...args) => event.execute(...args, client));
  else client.on(event.name, (...args) => event.execute(...args, client));
}

// ================== 4️⃣ MongoDB Connect ==================
mongoConnect();

// ================== 5️⃣ Deploy Global Commands ==================
async function deployGlobalCommands() {
  if (!process.env.CLIENT_ID) {
    console.error("❌ CLIENT_ID missing in .env. Global commands not deployed!");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  const commands = commandFiles.map(f => require(f).data.toJSON());

  try {
    console.log("🔄 Deploying global commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Global commands deployed!");
  } catch (err) {
    console.error("❌ Failed to deploy global commands:", err);
  }
}

// Deploy commands on startup
deployGlobalCommands();

// ================== 6️⃣ Ready Event (Inline) ==================
client.once("ready", () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  console.log(`🔹 Loaded ${client.commands.size} commands`);
  console.log(`🌐 Connected to ${client.guilds.cache.size} guild(s)`);
});

// ================== 7️⃣ Command Interaction Handler ==================
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(err);
    if (interaction.replied || interaction.deferred)
      await interaction.followUp({ content: "❌ Error executing command.", ephemeral: true });
    else
      await interaction.reply({ content: "❌ Error executing command.", ephemeral: true });
  }
});

// ================== 8️⃣ Handle New Guilds ==================
client.on("guildCreate", async guild => {
  console.log(`➡️ Joined new guild: ${guild.name} (${guild.id})`);

  // Deploy commands to the new guild instantly
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  const commands = commandFiles.map(f => require(f).data.toJSON());

  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id), { body: commands });
    console.log(`✅ Commands deployed to guild: ${guild.name}`);
  } catch (err) {
    console.error(`❌ Failed to deploy commands to guild: ${guild.name}`, err);
  }

  // Optional: send welcome message
  const defaultChannel = guild.channels.cache.find(
    ch => ch.type === 0 && ch.permissionsFor(guild.members.me).has("SendMessages")
  );
  if (defaultChannel) {
    defaultChannel.send(
      `👋 Thanks for adding me! Please run \`/setup\` to configure the ticket system.`
    );
  }
});

// ================== 9️⃣ Login ==================
client.login(process.env.TOKEN).then(() => console.log("🔑 Logging in..."));
