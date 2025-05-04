const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  username: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const chatHistorySchema = new mongoose.Schema({
  matchId: { type: String, required: true }, // "general" ou o ID da partida
  messages: [messageSchema]
}, { timestamps: true });

module.exports = mongoose.model('ChatHistory', chatHistorySchema);