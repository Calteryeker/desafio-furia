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

3. Crie as tabela no PostgreSQL:
   ```sql
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     username VARCHAR(100) NOT NULL UNIQUE,
     password_hash TEXT NOT NULL
   );

   CREATE TABLE IF NOT EXISTS public.session
   (
       sid character(100) COLLATE pg_catalog."default" NOT NULL,
       sess json NOT NULL,
       expire timestamp with time zone NOT NULL,
       CONSTRAINT session_pkey PRIMARY KEY (sid)
   )
   ```

4. Inicie:
   ```
   npm start
   ```

5. Acesse:
   - http://localhost:3000/
   - http://localhost:3000/furia-live

Imagens das telas:

![image](https://drive.google.com/uc?export=view&id=1OzCi-DDuXAZPzh7DJzvIOeRitAn90sfU)
Home Sem Login

![image](https://drive.google.com/uc?export=view&id=1yKhrlltIALsVYxXUElbMcaPmDmFHuHUP)
Home Chat sem login

![image](https://drive.google.com/uc?export=view&id=1wtpxdK1Ua7i0XNQpU8Ou9AfOlGDVQyo2)
Home Logado

![image](https://drive.google.com/uc?export=view&id=1W_pgliQXRs5WXDr1ZeT1G_yqrkfLEI5J)
Home Chat Logado

![image](https://drive.google.com/uc?export=view&id=1oUoMKd8peIFZdkvVys2nms1KPPr0m29f)
Sala de espera próxima partida

![image](https://drive.google.com/uc?export=view&id=1kvPfQcgQ9h7L2b87AIGwSDRYjU9qtjuT)
Chat da partida

