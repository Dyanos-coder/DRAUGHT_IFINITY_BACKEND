const mongoose = require('mongoose');
const Communication = require('./src/models/communication.model');

mongoose.connect('mongodb://localhost:27017/dls')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Chercher les communications planifiées
    const scheduledComms = await Communication.find({ status: 'scheduled' });
    console.log('Scheduled communications:');
    console.log(JSON.stringify(scheduledComms, null, 2));
    
    // Chercher toutes les communications
    const allComms = await Communication.find();
    console.log('\nAll communications:');
    console.log(JSON.stringify(allComms, null, 2));
    
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  }); 