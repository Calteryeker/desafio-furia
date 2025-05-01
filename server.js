const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const Message = require('./models/Message');
const hltvService = require('./hltvService');
require('dotenv').config();

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });
mongoose.connect(process.env.MONGO_URL);

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new pgSession({ pool: pgPool }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

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
  const matches = await hltvService.getLiveMatches();
  if (matches.length > 0 && req.session.userId) {
    res.render('live', { username: req.session.username });
  } else {
    res.send('⚠️ Nenhuma partida da FURIA em andamento ou você não está logado.');
  }
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

server.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));