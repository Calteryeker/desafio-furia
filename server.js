const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const Message = require('./models/Message');
const hltvService = require('./hltvService');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });
mongoose.connect(process.env.MONGO_URL);

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new pgSession({ pool: pgPool }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

var FuriaInfo = hltvService.scrapeFuriaData()

app.get('/', async (req, res) => {
  const latest = await FuriaInfo;
  res.render('landing', { user: req.session.username, data: latest });
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
  const nextMatch = furiaData.upcomingMatches[furiaData.upcomingMatches.length - 1];

  // Se há partida ao vivo e usuário logado, renderiza live
  if (liveMatch && req.session.userId) {
    return res.render('live', {
      username: req.session.username,
      match: liveMatch
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
    return res.render('nextMatch', {
      username: req.session.username,
      match: nextMatch
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

wss.on('connection', async (ws) => {
  const matches = await hltvService.getLiveMatches();
  if (matches.length === 0) {
    ws.send(JSON.stringify({ error: 'Chat indisponível no momento.' }));
    ws.close();
    return;
  }

  const matchId = matches[0].matchTime;
  const oldMessages = await Message.find({ matchId }).sort({ timestamp: 1 });
  oldMessages.forEach(msg => ws.send(JSON.stringify(msg)));

  ws.on('message', async (data) => {
    const { text } = JSON.parse(data);
    const message = new Message({ text, user: ws.user, matchId });
    await message.save();
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ user: ws.user, text }));
      }
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