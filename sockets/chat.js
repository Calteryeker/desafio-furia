const ChatHistory = require('../models/ChatHistory'); // modelo do MongoDB

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Novo usuário conectado');

    async function saveMessageToHistory({ username, text, matchId }) {
        const history = await ChatHistory.findOneAndUpdate(
          { matchId },
          { $push: { messages: { username, text } } },
          { new: true, upsert: true }
        );
        return history.messages.at(-1); // Retorna a última mensagem adicionada
    }

    // Recebe mensagens do frontend
    socket.on('sendMessage', async (data) => {
      const { username, text, matchId } = data;

      const message = await saveMessageToHistory(data);

      // Envia mensagem para todos que estão no mesmo chat
      io.to(matchId).emit('newMessage', message);
    });

    // Join específico por matchId
    socket.on('joinRoom', (matchId) => {
      socket.join(matchId);
    });

    socket.on('disconnect', () => {
      console.log('Usuário desconectado');
    });
  });
};