# FURIA Chat App

Chat em tempo real durante partidas ao vivo da FURIA, com autenticação de usuários e histórico de mensagens.

## Requisitos

- Node.js
- MongoDB
- PostgreSQL

## Configuração

1. Instale dependências:
   ```
   npm install
   ```

2. Configure `.env`:
   ```
   POSTGRES_URL=postgres://usuario:senha@localhost/db
   MONGO_URL=mongodb://localhost:27017/furia-chat
   SESSION_SECRET=algumasecreta
   ```

3. Crie a tabela de usuários no PostgreSQL:
   ```sql
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     username VARCHAR(100) NOT NULL UNIQUE,
     password_hash TEXT NOT NULL
   );
   ```

4. Inicie:
   ```
   npm start
   ```

5. Acesse:
   - http://localhost:3000/login
   - http://localhost:3000/furia-live