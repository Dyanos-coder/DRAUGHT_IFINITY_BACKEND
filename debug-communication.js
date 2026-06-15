const mongoose = require('mongoose');
const Communication = require('./src/models/communication.model');

// Utiliser l'URL MongoDB fournie par l'utilisateur
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://sannicharbel:fzdLOWRUgFCHYqwl@cluster0.fccao1l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Créer une communication de test planifiée pour 5 minutes dans le futur ou le passé
async function createTestScheduledCommunication(inPast = false) {
  try {
    const date = new Date();
    
    if (inPast) {
      // Créer une date 5 minutes dans le passé
      date.setMinutes(date.getMinutes() - 5);
      console.log(`Creating test communication with past date: ${date.toISOString()}`);
    } else {
      // Créer une date 5 minutes dans le futur
      date.setMinutes(date.getMinutes() + 5);
      console.log(`Creating test communication with future date: ${date.toISOString()}`);
    }
    
    const newComm = new Communication({
      title: inPast ? 'Test Past Communication' : 'Test Future Communication',
      content: `This is a test communication scheduled ${inPast ? '5 minutes in the past' : '5 minutes in the future'}.`,
      recipients: 'all',
      status: 'scheduled',
      scheduledDate: date
    });
    
    await newComm.save();
    console.log(`Created test communication scheduled for: ${date.toISOString()}`);
    console.log(`Communication ID: ${newComm._id}`);
    return newComm;
  } catch (error) {
    console.error('Error creating test communication:', error);
  }
}

// Vérifier toutes les communications et leur statut
async function checkAllCommunications() {
  try {
    const communications = await Communication.find();
    console.log('All Communications:');
    communications.forEach(comm => {
      console.log(`ID: ${comm._id}`);
      console.log(`Title: ${comm.title}`);
      console.log(`Status: ${comm.status}`);
      console.log(`Scheduled Date: ${comm.scheduledDate ? comm.scheduledDate.toISOString() : 'Not scheduled'}`);
      console.log(`Is New? ${comm.isNew ? 'Yes' : 'No'}`);
      console.log(`Recipients: ${comm.recipients}`);
      console.log(`Created At: ${comm.createdAt}`);
      console.log(`Updated At: ${comm.updatedAt}`);
      console.log('-----------------------------------');
    });

    console.log(`\nTotal communications: ${communications.length}`);
    
    // Compter par statut
    const statusCounts = {};
    communications.forEach(comm => {
      statusCounts[comm.status] = (statusCounts[comm.status] || 0) + 1;
    });
    console.log('Communications by status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`${status}: ${count}`);
    });
    
    // Vérifier les dates de programmation
    const scheduledComms = communications.filter(comm => comm.status === 'scheduled');
    if (scheduledComms.length > 0) {
      console.log('\nScheduled communications details:');
      const now = new Date();
      scheduledComms.forEach(comm => {
        const isPast = comm.scheduledDate <= now;
        console.log(`ID: ${comm._id}`);
        console.log(`Title: ${comm.title}`);
        console.log(`Scheduled for: ${comm.scheduledDate ? comm.scheduledDate.toISOString() : 'No date'}`);
        console.log(`Is past due: ${isPast ? 'YES' : 'No'}`);
        console.log(`Current time: ${now.toISOString()}`);
        console.log(`Time difference: ${Math.floor((comm.scheduledDate - now) / 1000 / 60)} minutes`);
        console.log('-----------------------------------');
      });
    }
    
  } catch (error) {
    console.error('Error fetching communications:', error);
  }
}

// Simuler la logique de mise à jour des communications planifiées
async function simulateUpdateScheduledCommunications() {
  try {
    const now = new Date();
    console.log(`Current time: ${now.toISOString()}`);
    
    const scheduledCommunications = await Communication.find({ 
      status: 'scheduled', 
      scheduledDate: { $lte: now } 
    });
    
    console.log(`Found ${scheduledCommunications.length} communications that should be marked as sent:`);
    
    for (const communication of scheduledCommunications) {
      console.log(`Would mark as sent: Communication ID ${communication._id}`);
      console.log(`Title: ${communication.title}`);
      console.log(`Scheduled for: ${communication.scheduledDate.toISOString()}`);
      console.log(`Created at: ${communication.createdAt.toISOString()}`);
      console.log(`Is new? ${communication.isNew ? 'Yes' : 'No'}`);
      console.log('-----------------------------------');
      
      // Mettre à jour le statut
      communication.status = 'sent';
      await communication.save();
      console.log(`Updated status to 'sent'`);
    }
  } catch (error) {
    console.error('Error simulating update:', error);
  }
}

// Fonction pour forcer la mise à jour du statut des communications
async function forceUpdateCommunicationStatus(id, newStatus) {
  try {
    if (!id) {
      console.error('Communication ID is required');
      return;
    }
    
    const communication = await Communication.findById(id);
    if (!communication) {
      console.error(`Communication with ID ${id} not found`);
      return;
    }
    
    console.log(`Updating communication: ${communication.title}`);
    console.log(`Current status: ${communication.status}`);
    console.log(`New status: ${newStatus}`);
    
    communication.status = newStatus;
    await communication.save();
    console.log(`Status successfully updated to: ${newStatus}`);
  } catch (error) {
    console.error('Error updating communication status:', error);
  }
}

// Exécuter le script principal
async function main() {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB successfully');
    
    // Afficher toutes les communications
    console.log('\n=== CHECKING EXISTING COMMUNICATIONS ===\n');
    await checkAllCommunications();
    
    // Vérifier les arguments de ligne de commande
    const args = process.argv.slice(2);
    
    // Créer une communication de test?
    if (args.includes('--create-test')) {
      console.log('\n=== CREATING TEST SCHEDULED COMMUNICATION ===\n');
      await createTestScheduledCommunication(false);
      
      // Revérifier toutes les communications
      console.log('\n=== RECHECKING ALL COMMUNICATIONS ===\n');
      await checkAllCommunications();
    }
    
    // Créer une communication de test avec une date dans le passé?
    if (args.includes('--create-past-test')) {
      console.log('\n=== CREATING TEST COMMUNICATION WITH PAST DATE ===\n');
      await createTestScheduledCommunication(true);
      
      // Revérifier toutes les communications
      console.log('\n=== RECHECKING ALL COMMUNICATIONS ===\n');
      await checkAllCommunications();
    }
    
    // Simuler la mise à jour des communications planifiées?
    if (args.includes('--update')) {
      console.log('\n=== UPDATING SCHEDULED COMMUNICATIONS ===\n');
      await simulateUpdateScheduledCommunications();
      
      // Revérifier toutes les communications
      console.log('\n=== RECHECKING ALL COMMUNICATIONS ===\n');
      await checkAllCommunications();
    }
    
    // Forcer la mise à jour du statut d'une communication spécifique?
    const forceUpdateIndex = args.indexOf('--force-update');
    if (forceUpdateIndex !== -1 && forceUpdateIndex + 2 < args.length) {
      const commId = args[forceUpdateIndex + 1];
      const newStatus = args[forceUpdateIndex + 2];
      
      if (commId && newStatus) {
        console.log(`\n=== FORCE UPDATING COMMUNICATION ${commId} TO ${newStatus} ===\n`);
        await forceUpdateCommunicationStatus(commId, newStatus);
        
        // Revérifier toutes les communications
        console.log('\n=== RECHECKING ALL COMMUNICATIONS ===\n');
        await checkAllCommunications();
      }
    }
    
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

main(); 