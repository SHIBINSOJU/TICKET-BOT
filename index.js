// File: index.js

require("dotenv").config();
const fs = require("node:fs");
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const mongoConnect = require("./utils/mongoConnect");

// ================== 1️⃣ Create Client ==================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// ================== 2️⃣ Load Commands ==================
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}
console.log(`🔹 Loaded ${client.commands.size} commands.`);

// ================== 3️⃣ Load Events ==================
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// ================== 4️⃣ MongoDB Connect ==================
mongoConnect();

// ================== 5️⃣ Login ==================
client.login(process.env.TOKEN);
