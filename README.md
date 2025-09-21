# 🚀 QUIZ 1ADS - Versão React

_A interface principal do Quiz App mostrando o menu, ranking e design moderno._

Bem-vindo à versão moderna do **QUIZ 1ADS**, uma aplicação de quiz interativa totalmente reconstruída com **React** e **Vite.js**. Este projeto transforma a experiência original numa "Single-Page Application" (SPA) rápida, reativa e altamente organizada, mantendo todas as funcionalidades que o tornam especial.

Desafie-se no modo single-player com perguntas geradas por IA ou enfrente outros jogadores em duelos 1v1 em tempo real.

---

## ✨ Funcionalidades Principais

* **Front-end Moderno:** A interface foi migrada para React, utilizando uma arquitetura baseada em componentes para maior organização, reutilização de código e manutenibilidade.
* **🧠 Geração de Quiz com IA:** Perguntas e respostas são geradas dinamicamente através de uma API de Inteligência Artificial, proporcionando conteúdo infinito e variado.
* **👤 Modo Single-Player:**
    * Escolha um tema e uma dificuldade (Fácil, Médio, Difícil).
    * Jogue sozinho, receba explicações para cada resposta e tenha seu resultado salvo no perfil.
* **⚔️ Duelos 1v1 em Tempo Real:**
    * **Partidas Públicas:** Encontre um oponente aleatório com base no sistema de ranking ELO.
    * **Salas Privadas:** Crie uma sala com um código único para desafiar amigos diretamente.
    * **Opção de Revanche:** Jogue novamente contra o mesmo oponente ao final de um duelo.
* **🔒 Sistema de Autenticação Completo:**
    * Registo e Login de utilizadores com validação de dados.
    * Recuperação de senha através de link enviado por e-mail.
* **🏆 Perfil de Utilizador e Ranking:**
    * Perfil pessoal com estatísticas detalhadas e histórico de jogos.
    * Galeria de avatares para personalização do perfil.
    * Ranking de jogadores com filtros (Global, Mensal e Semanal).

---

## 🛠️ Tecnologias Utilizadas

* **Front-end (Client-side):**
    * **React.js:** Para a construção de uma interface de utilizador reativa e componentizada.
    * **Vite.js:** Como ferramenta de build e servidor de desenvolvimento de alta performance.
    * **Socket.IO Client:** Para a comunicação em tempo real com o servidor.
    * **CSS3:** Para estilização moderna e responsiva.

* **Back-end (Server-side):**
    * **Node.js** com **Express.js:** Para a criação da API REST e gestão das rotas.
    * **Socket.IO Server:** Para a lógica do multiplayer, salas e eventos em tempo real.
    * **SQLite:** Banco de dados para armazenar utilizadores, quizzes e resultados.
    * **CORS:** Para gestão de permissões de acesso entre o front-end e o back-end.

---

## 🚀 Como Executar o Projeto Localmente

Siga os passos abaixo para configurar e rodar a aplicação no seu ambiente de desenvolvimento.

### Pré-requisitos
* [Node.js](https://nodejs.org/) (versão 18 ou superior)
* NPM (instalado com o Node.js)

### 1. Clonar o Repositório
```bash
git clone [https://github.com/seu-usuario/quiz-react.git](https://github.com/seu-usuario/quiz-react.git)
cd quiz-react
2. Configurar o Back-end
Recomenda-se configurar o servidor primeiro. Se o seu back-end estiver numa pasta separada (ex: backend/), navegue até ela.

Bash

# Navegar para a pasta do servidor
cd backend

# Instalar as dependências
npm install
Variáveis de Ambiente: Crie um ficheiro .env na raiz da pasta backend/ e adicione as suas chaves de API:

OPENROUTER_API_KEY="sua_chave_secreta_aqui"
Iniciar o Servidor:

Bash

# Iniciar o servidor back-end
npm start
O servidor estará a rodar em http://localhost:3000 (ou a porta que você configurou).

3. Configurar o Front-end (React)
Navegue de volta para a pasta principal do projeto e instale as dependências do front-end.

Bash

# Se estiver na pasta backend, volte uma pasta
cd ..

# Instalar as dependências do front-end
npm install

# Iniciar o servidor de desenvolvimento do Vite
npm run dev
A aplicação estará disponível em http://localhost:5173. O Vite irá abrir o seu navegador automaticamente.

💡 Dica para Desenvolvimento Local
Se o seu back-end estiver a rodar numa máquina ou porta diferente, lembre-se de ajustar a constante API_URL no topo do ficheiro src/App.jsx para o endereço correto do seu servidor.

📜 Scripts Disponíveis
No diretório do projeto front-end, pode rodar:

npm run dev: Inicia o servidor de desenvolvimento com hot-reload.

npm run build: Compila e otimiza os ficheiros do front-end para produção na pasta dist/.

npm run preview: Inicia um servidor local para visualizar a versão de produção que está na pasta dist/.







