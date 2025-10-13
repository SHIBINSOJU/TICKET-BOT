const mongoose = require('mongoose');

const ticketConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    staffRoleId: { type: String, required: true }, // For staff permissions
    ticketCategoryId: { type: String, required: true }, // Where to create tickets
    title: { type: String, required: true },
    description: { type: String, required: true },
    buttons: [{
        customId: { type: String, required: true },
        label: { type: String, required: true },
        emoji: { type: String, required: false },
    }],
});

module.exports = mongoose.model('TicketConfig', ticketConfigSchema);
