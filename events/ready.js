module.exports = {
  name: "ready",
  once: true,
  execute(client) {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log(`🔹 Loaded ${client.commands.size} commands`);
  },
};
