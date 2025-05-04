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

app.use(session({
  store: new pgSession({ pool: pgPool }),
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true
}));

var FuriaInfo = hltvService.scrapeFuriaData()

app.get('/', async (req, res) => {
  const latest = await FuriaInfo;
  
  let history = await ChatHistory.findOne({ matchId: "general" }); // ou match.id

  if (!history){
    history = await ChatHistory.collection.insertOne({matchId : "general", messages: []})
  }

  const messages = history ? history.messages : [];
  res.render('landing', {
    username: req.session.username,
    data: latest,
    messages
  });
});

app.get('/login', (req, res) => res.render('login'));
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await pgPool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = result.rows[0];
  if (user && await bcrypt.compare(password, user.password_hash)) {
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/furia-live');
  } else {
    res.send('Login inválido.');
  }
});

app.get('/register', (req, res) => res.render('register'));
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await pgPool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, hash]);
  res.redirect('/login');
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
    }

    const messages = history ? history.messages : []; 

    return res.render('live', {
      username: req.session.username,
      match: liveMatch,
      messages
    });
  }

  // Se não está logado, mostra botão para login
  if (!req.session.userId) {
    return res.send(`
      <h2>⚠️ Você não está logado!</h2>
      <a href="/login">
        <button>Fazer login</button>
      </a>
    `);
  }

  // Usuário logado, mas não há partida ao vivo
  if (nextMatch) {
    let history = await ChatHistory.findOne({ matchId: "general" }); // ou match.id

    if (!history){
      history = await ChatHistory.collection.insertOne({matchId : "general", messages:[]})
    }
  
    const messages = history ? history.messages : [];
    return res.render('nextMatch', {
      username: req.session.username,
      match: nextMatch,
      messages
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