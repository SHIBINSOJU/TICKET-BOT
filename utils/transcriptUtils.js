const fs = require("fs");
const path = require("path");

async function generateTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 }); // Fetch last 100 messages
  const lines = messages
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map(m => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}`);

  const transcript = lines.join("\n");
  const filePath = path.join(__dirname, `../transcripts/${channel.id}.txt`);

  // Ensure folder exists
  if (!fs.existsSync(path.join(__dirname, "../transcripts"))) fs.mkdirSync(path.join(__dirname, "../transcripts"));

  fs.writeFileSync(filePath, transcript, "utf-8");
  return filePath;
}

module.exports = { generateTranscript };
