const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buttons')
        .setDescription('Creates a message with a custom set of buttons.')
        .addStringOption(option =>
            option.setName('definition')
                .setDescription('Define buttons like: Label:Style:ID_or_URL, Label2:Style2:ID_or_URL2')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The text message to display above the buttons.')
                .setRequired(true)),

    async execute(interaction) {
        const buttonsDefinition = interaction.options.getString('definition');
        const messageContent = interaction.options.getString('message');

        // Each ActionRow can hold a maximum of 5 buttons
        const row = new ActionRowBuilder();
        const buttons = [];

        // Split the definition string into individual button parts
        // Example part: "Google:Link:https://google.com" or "Confirm:Success:confirm_action"
        const buttonParts = buttonsDefinition.split(',').map(part => part.trim());

        if (buttonParts.length > 5) {
            return interaction.reply({ content: 'You can only create a maximum of 5 buttons per message.', ephemeral: true });
        }

        for (const part of buttonParts) {
            const [label, style, idOrUrl] = part.split(':').map(p => p.trim());

            if (!label || !style || !idOrUrl) {
                return interaction.reply({ content: `Invalid button format: "${part}". Please use "Label:Style:ID_or_URL".`, ephemeral: true });
            }

            const button = new ButtonBuilder().setLabel(label);

            // Set style and identifier (CustomId for regular buttons, URL for link buttons)
            if (style.toUpperCase() === 'LINK') {
                button.setStyle(ButtonStyle.Link).setURL(idOrUrl);
            } else {
                // Map string style to ButtonStyle enum
                const buttonStyle = ButtonStyle[style.charAt(0).toUpperCase() + style.slice(1).toLowerCase()];
                if (!buttonStyle) {
                    return interaction.reply({ content: `Invalid style "${style}". Use Primary, Secondary, Success, Danger, or Link.`, ephemeral: true });
                }
                button.setStyle(buttonStyle).setCustomId(idOrUrl);
            }
            buttons.push(button);
        }

        row.addComponents(buttons);

        await interaction.reply({
            content: messageContent,
            components: [row],
        });
    },
};
