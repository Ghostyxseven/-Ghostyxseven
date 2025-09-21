import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Define o caminho absoluto para o arquivo do banco de dados
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'quiz.db');

// Cria e abre o banco de dados
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Erro ao conectar ao SQLite:", err.message);
    } else {
        console.log("Conectado ao banco de dados SQLite.");
        // Habilita o modo WAL para melhor concorrência e evitar travamentos
        db.exec('PRAGMA journal_mode = WAL;', (walErr) => {
            if (walErr) {
                console.error("Erro ao ativar modo WAL:", walErr.message);
            } else {
                console.log("Modo WAL ativado com sucesso.");
            }
        });
    }
});

// Exporta a conexão como padrão
export default db;