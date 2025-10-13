const { InteractionType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const GuildConfig = require('../../models/guildConfig');
const Ticket = require('../../models/ticket');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // --- 1. HANDLE SLASH COMMANDS ---
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing command ${interaction.commandName}:`, error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
            return; // Stop execution after handling the command
        }

        // --- 2. HANDLE BUTTON INTERACTIONS ---
        if (interaction.isButton()) {
            // Check if it's a ticket creation button
            if (interaction.customId.startsWith('ticket_create_')) {
                await handleTicketCreation(interaction, client);
            }
            // Add other button handlers here later (e.g., close, claim)
            // if (interaction.customId === 'close_ticket') { ... }
        }

        // --- 3. HANDLE MODAL SUBMISSIONS ---
        if (interaction.type === InteractionType.ModalSubmit) {
            if (interaction.customId.startsWith('ticket_modal_')) {
                await handleModalSubmit(interaction, client);
            }
        }
    },
};

// --- HELPER FUNCTION FOR TICKET CREATION ---
async function handleTicketCreation(interaction, client) {
    try {
        const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
        if (!guildConfig) {
            return await interaction.reply({ content: 'The ticket system has not been configured for this server. Please ask an admin to run /setup.', ephemeral: true });
        }

        // Prevent creating multiple tickets
        const existingTicket = await Ticket.findOne({ guildId: interaction.guild.id, creatorId: interaction.user.id, status: 'open' });
        if (existingTicket) {
            return await interaction.reply({ content: `You already have an open ticket in <#${existingTicket.channelId}>.`, ephemeral: true });
        }

        // Create the modal
        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${interaction.customId.split('_')[2]}`) // e.g., ticket_modal_support
            .setTitle('Create a New Ticket');

        const reasonInput = new TextInputBuilder()
            .setCustomId('ticket_reason')
            .setLabel("What is the reason for this ticket?")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Please provide as much detail as possible.')
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(firstActionRow);

        // Show the modal to the user
        await interaction.showModal(modal);

    } catch (error) {
        console.error('Error in handleTicketCreation:', error);
    }
}

// --- HELPER FUNCTION FOR MODAL SUBMISSION ---
async function handleModalSubmit(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const reason = interaction.fields.getTextInputValue('ticket_reason');
    const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });

    try {
        // Increment ticket count
        guildConfig.ticketCount += 1;
        await guildConfig.save();
        const ticketNumber = guildConfig.ticketCount;

        // Create the ticket channel
        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}-${ticketNumber}`,
            type: ChannelType.GuildText,
            parent: guildConfig.ticketCategoryId,
            permissionOverwrites: [
                {
                    id: interaction.guild.id, // @everyone role
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: interaction.user.id, // The user who created the ticket
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles],
                },
                {
                    id: client.user.id, // The bot itself
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels],
                },
                // Add support roles
                ...guildConfig.supportRoleIds.map(roleId => ({
                    id: roleId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                })),
            ],
        });

        // Create a new ticket document in MongoDB
        const newTicket = await Ticket.create({
            guildId: interaction.guild.id,
            channelId: channel.id,
            creatorId: interaction.user.id,
            reason: reason,
        });

        // Create the embed and buttons for inside the ticket channel
        const ticketEmbed = new EmbedBuilder()
            .setTitle(`Ticket #${ticketNumber}`)
            .setDescription(`**Creator:** <@${interaction.user.id}>\n**Reason:**\n\`\`\`${reason}\`\`\``)
            .setColor('Green')
            .setTimestamp();

        const ticketButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('✅'),
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji('🧍'),
                new ButtonBuilder().setCustomId('warn_user').setLabel('Warn User').setStyle(ButtonStyle.Secondary).setEmoji('⚠️')
            );

        await channel.send({ content: `<@&${guildConfig.supportRoleIds.join('>, <@&')}>, a new ticket has been created by <@${interaction.user.id}>.`, embeds: [ticketEmbed], components: [ticketButtons] });
        await interaction.editReply({ content: `Your ticket has been created in <#${channel.id}>.`, ephemeral: true });

    } catch (error) {
        console.error('Error handling modal submission:', error);
        await interaction.editReply({ content: 'An error occurred while creating your ticket. Please try again later.', ephemeral: true });
    }
}
