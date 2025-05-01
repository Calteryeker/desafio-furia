const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text: String,
  user: String,
  timestamp: { type: Date, default: Date.now },
  matchId: String,
});

module.exports = mongoose.model('Message', messageSchema);