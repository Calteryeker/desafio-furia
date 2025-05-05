const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const Message = require('./models/Message');
const hltvService = require('./hltvService');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();
const socketIo = require('socket.io');
const ChatHistory = require('./models/ChatHistory');

const app = express();
const server = require('http').createServer(app);
const io = socketIo(server); // associando o socket ao servidor

// Exporta io para usar nos handlers
module.exports.io = io;

// Inicializa os sockets
require('./sockets/chat')(io);

const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });
mongoose.connect(process.env.MONGO_URL);

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  store: new pgSession({ pool: pgPool }),
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true
})
app.use(sessionMiddleware);

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

var FuriaInfo = hltvService.scrapeFuriaData()

app.get('/', async (req, res) => {
  const latest = await FuriaInfo;
  
  let history = await ChatHistory.findOne({ matchId: "general" }); // ou match.id

  if (!history){
    history = await ChatHistory.collection.insertOne({matchId : "general", messages: []})
    history = await ChatHistory.findOne({ matchId: "general" }); // ou match.id
  }

  let messages = history ? history.messages : [];

  let recentMessages = messages.filter(msg => new Date() - new Date(msg.createdAt) <= 3 * 60 * 1000);

  res.render('landing', {
    username: req.session.username,
    data: latest,
    messages: recentMessages
  });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await pgPool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = result.rows[0];
  if (user && await bcrypt.compare(password, user.password_hash)) {
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/');
  } else {
    res.send('Login inválido.');
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao fazer logoff.' });
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  const usernameRegex = /^[a-zA-Z0-9_.]+$/;

  // Validação do nome de usuário
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ error: 'Nome de usuário inválido. Use apenas letras, números, "_" e "."' });
  }

  // Validação da senha
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });
  }

  try {
    // Verifica se o nome de usuário já existe
    const result = await pgPool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      return res.status(409).json({ error: 'Nome de usuário já está em uso.' });
    }

    // Criptografa e insere
    const hashedPassword = await bcrypt.hash(password, 10);
    await pgPool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, hashedPassword]
    );

    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao registrar usuário.' });
  }
});

app.get('/furia-live', async (req, res) => {
  const furiaData = await FuriaInfo;
  const liveMatch = furiaData.liveMatch;
  const nextMatch = furiaData.upcomingMatches[0].matches[0];

  // Se há partida ao vivo e usuário logado, renderiza live
  if (liveMatch && req.session.userId) {
    let history = await ChatHistory.findOne({ matchId: liveMatch.match_id }); // ou match.id

    if (!history){
      history = await ChatHistory.collection.insertOne({matchId : liveMatch.match_id, messages:[]})
      history = await ChatHistory.findOne({ matchId: liveMatch.match_id });
    }

    let messages = history ? history.messages : []; 

    let recentMessages = messages.filter(msg => new Date() - new Date(msg.createdAt) <= 3 * 60 * 1000);

    return res.render('live', {
      username: req.session.username,
      match: liveMatch,
      messages: recentMessages
    });
  }

  // Se não está logado, mostra botão para login
  if (!req.session.userId) {
    return res.redirect('/');
  }

  // Usuário logado, mas não há partida ao vivo
  if (nextMatch) {
    let history = await ChatHistory.findOne({ matchId: "general" }); // ou match.id

    if (!history){
      history = await ChatHistory.collection.insertOne({matchId : "general", messages:[]})
      history = await ChatHistory.findOne({ matchId: "general" });
    }

    const messages = history ? history.messages : [];
    
    let recentMessages = messages.filter(msg => new Date() - new Date(msg.createdAt) <= 3 * 60 * 1000);

    return res.render('nextMatch', {
      username: req.session.username,
      match: nextMatch,
      messages: recentMessages
    });
  }

  // Sem partida ao vivo ou agendada
  res.send('⚠️ A FURIA ainda não está no servidor e não há partidas agendadas!');
});

server.on('upgrade', (req, socket, head) => {
  session(req, {}, () => {
    if (!req.session.userId) return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.user = req.session.username;
      wss.emit('connection', ws, req);
    });
  });
});

cron.schedule('* 2 * * *', async () => {
  try {
    FuriaInfo = await hltvService.scrapeFuriaData();
    console.log('Dados da FURIA atualizados.');
  } catch (err) {
    console.error('Erro ao atualizar dados da FURIA:', err);
  }
});

server.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));