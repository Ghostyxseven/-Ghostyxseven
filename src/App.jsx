/**
 * Importa as bibliotecas essenciais do React e o cliente do Socket.IO.
 * useState: Para gerir o estado dos componentes (ex: qual tela está ativa).
 * useEffect: Para executar código em momentos específicos (ex: ao carregar a página).
 * useCallback: Para otimizar funções e evitar recriações desnecessárias.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

// --- Constantes e Configuração Inicial ---
// Define o endereço base da sua API para ser reutilizado.
const API_URL = "https://api.usermicael.online";
// Inicia a conexão com o servidor de multiplayer.
const socket = io(API_URL);

// --- Componentes de Ícones (SVGs) ---
// Componentes React simples para renderizar os ícones de estatísticas no perfil.
const StatsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"></path><path d="M13 7h-2v6h2V7zm-1 8c-.552 0-1 .448-1 1s.448 1 1 1 1-.448 1-1-.448-1-1-1z"></path></svg>;
const PointsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px"><path d="M19 2H5c-1.103 0-2 .897-2 2v16c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2V4c0-1.103-.897-2-2-2zM5 20V4h14l.002 16H5z"></path><path d="m15.707 9.293-1.414-1.414L12 10.172 9.707 7.879l-1.414 1.414L10.586 12l-2.293 2.293 1.414 1.414L12 13.828l2.293 2.293 1.414-1.414L13.414 12l2.293-2.707z"></path></svg>;
const FavoriteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px"><path d="M21.947 9.179a1.001 1.001 0 0 0-.868-.679H16.94l-1.581-5.279a1 1 0 0 0-1.94-.488l-1.6 5.279H7.82a1 1 0 0 0-.868.679L3.465 18h17.07l-3.588-8.821zM12 17c-1.103 0-2-.897-2-2s.897-2 2-2 2 .897 2 2-.897 2-2 2z"></path></svg>;

// --- Componentes Reutilizáveis ---

// Componente para mostrar notificações (toasts) de sucesso ou erro.
const Toast = ({ message, isSuccess, visible }) => {
    if (!visible) return null;
    return <div className={`message-box ${isSuccess ? 'success' : 'error'} visible`} aria-live="polite">{message}</div>;
};

// Componente para mostrar um indicador de carregamento.
const LoadingScreen = ({ text = "A carregar..." }) => (
    <section className="screen active"><p>{text}</p><div className="loader"></div></section>
);

// Componente para renderizar o avatar do jogador (com imagem ou com a letra inicial).
const Avatar = ({ url, name }) => {
    if (url && url.startsWith('./public')) {
         return <img src={url.replace('./public', '')} alt={`Avatar de ${name}`} className="avatar-image" />;
    }
    if (url) {
        return <img src={url} alt={`Avatar de ${name}`} className="avatar-image" />;
    }
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return <span className="avatar-letter">{initial}</span>;
};


// --- Componente Principal da Aplicação ---
// Este é o "cérebro" do aplicativo. Ele gere todos os estados principais
// e decide qual tela (componente) deve ser mostrada ao utilizador.
export default function App() {
    // Estado principal que controla qual tela é mostrada.
    const [currentScreen, setCurrentScreen] = useState('loading');
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
    const [toast, setToast] = useState({ message: '', visible: false });
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('token'));
    const [dificuldade, setDificuldade] = useState('Médio');
    const [quizData, setQuizData] = useState(null);
    const [multiplayerState, setMultiplayerState] = useState({ room: null, myPlayer: null, opponentPlayer: null, question: null, result: null, roomCode: '' });

    // Função para mostrar notificações. `useCallback` otimiza a performance.
    const showToast = useCallback((message, isSuccess = true) => {
        setToast({ message, isSuccess, visible: true });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
    }, []);

    // `useEffect` para aplicar a classe do tema ao body sempre que o estado `theme` mudar.
    useEffect(() => {
        document.body.className = theme === 'royal-library' ? 'theme-royal-library' : '';
        localStorage.setItem('theme', theme);
    }, [theme]);
    
    // Verifica se há um token de redefinição de senha na URL ao carregar e define a tela inicial.
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const passwordResetToken = urlParams.get('token');

        if (passwordResetToken) {
            setCurrentScreen('resetPassword');
            return;
        }

        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('nome');
        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser({ nome: storedUser });
            setCurrentScreen('theme');
        } else {
            setCurrentScreen('login');
        }
    }, []);
    
    // `useEffect` para configurar todos os "ouvintes" de eventos do Socket.IO para o multiplayer.
    useEffect(() => {
        const onMatchFound = (data) => {
            setMultiplayerState({ room: data.room, myPlayer: data.players.find(p => p.socketId === socket.id), opponentPlayer: data.players.find(p => p.socketId !== socket.id), question: null, result: null });
            setCurrentScreen('multiplayerQuiz');
            showToast("Oponente encontrado!", true);
        };
        const onNewQuestion = (q) => setMultiplayerState(prev => ({ ...prev, question: q, roundResult: null }));
        const onRoundResult = (r) => setMultiplayerState(prev => ({ ...prev, roundResult: r }));
        const onGameOver = (r) => {
            setMultiplayerState(prev => ({ ...prev, result: r }));
            setCurrentScreen('multiplayerResult');
            if(r.eloChanges && r.eloChanges[socket.id]) {
                localStorage.setItem('eloScore', r.eloChanges[socket.id].new);
            }
        };
        const onPrivateRoomCreated = ({ roomCode }) => {
            setMultiplayerState(prev => ({...prev, roomCode}));
            setCurrentScreen('privateRoom');
        }
        const onGameError = ({message}) => { showToast(message, false); setCurrentScreen('theme'); }
        const onRematchRequested = () => { showToast("O seu oponente quer uma revanche!", true); }

        socket.on('matchFound', onMatchFound);
        socket.on('newQuestion', onNewQuestion);
        socket.on('roundResult', onRoundResult);
        socket.on('gameOver', onGameOver);
        socket.on('privateRoomCreated', onPrivateRoomCreated);
        socket.on('gameError', onGameError);
        socket.on('rematchRequestedByOpponent', onRematchRequested);

        return () => {
            socket.off('matchFound'); socket.off('newQuestion');
            socket.off('roundResult'); socket.off('gameOver');
            socket.off('privateRoomCreated'); socket.off('gameError');
            socket.off('rematchRequestedByOpponent');
        };
    }, [showToast]);

    // Função para fazer o login do utilizador.
    const handleLogin = async (email, password) => {
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, senha: password })
            });
            const data = await res.json();
            if (data.token) {
                localStorage.setItem("token", data.token); localStorage.setItem("nome", data.nome);
                localStorage.setItem("userId", data.userId); localStorage.setItem("eloScore", data.eloScore);
                localStorage.setItem("avatarUrl", data.avatarUrl || "");
                setToken(data.token); setUser({ nome: data.nome });
                setCurrentScreen('theme'); showToast("Login bem-sucedido!", true);
            } else { showToast(data.erro || "Erro ao entrar", false); }
        } catch { showToast("Erro de conexão.", false); }
    };

    // Função para fazer logout.
    const handleLogout = () => {
        localStorage.clear(); setUser(null); setToken(null);
        setCurrentScreen('login'); showToast("Você saiu da sua conta.", true);
    };

    // Função para gerar um quiz (por tema ou aleatório).
    const handleGerarQuiz = async (tema, tipo) => {
        setCurrentScreen('loading');
        const isAleatorio = tipo === 'aleatorio';
        if (!isAleatorio && !tema) { showToast("Insira um tema.", false); setCurrentScreen('theme'); return; }
        
        try {
            const url = isAleatorio ? `${API_URL}/api/aleatorio` : `${API_URL}/api/gerar`;
            const options = {
                method: isAleatorio ? 'GET' : 'POST',
                headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${token}` }
            };
            if (!isAleatorio) {
                options.body = JSON.stringify({ tema, dificuldade });
            }
            const res = await fetch(url, options);
            const data = await res.json();
            if (data.perguntas?.length > 0) {
                setQuizData({ tema: data.tema || tema, perguntas: data.perguntas });
                setCurrentScreen('quiz');
            } else { throw new Error(data.erro || "Não foi possível gerar perguntas."); }
        } catch (err) { showToast(err.message, false); setCurrentScreen('theme'); }
    };
    
    // Função que decide qual tela renderizar com base no estado `currentScreen`.
    const renderScreen = () => {
        switch (currentScreen) {
            case 'loading': return <LoadingScreen />;
            case 'login': return <LoginScreen onLogin={handleLogin} showToast={showToast} setCurrentScreen={setCurrentScreen} />;
            case 'forgotPassword': return <ForgotPasswordScreen showToast={showToast} setCurrentScreen={setCurrentScreen} />;
            case 'resetPassword': return <ResetPasswordScreen showToast={showToast} setCurrentScreen={setCurrentScreen} />;
            case 'theme': return <ThemeScreen user={user} onGerarQuiz={(t) => handleGerarQuiz(t, 'tema')} onQuizAleatorio={() => handleGerarQuiz(null, 'aleatorio')} dificuldade={dificuldade} setDificuldade={setDificuldade} setCurrentScreen={setCurrentScreen} />;
            case 'quiz': return <QuizScreen quizData={quizData} onFinish={() => { setQuizData(null); setCurrentScreen('theme'); }} showToast={showToast} token={token} />;
            case 'profile': return <ProfileScreen setCurrentScreen={setCurrentScreen} handleLogout={handleLogout} showToast={showToast} token={token} />;
            case 'multiplayerWait': return <MultiplayerWaitScreen setCurrentScreen={setCurrentScreen} />;
            case 'privateRoom': return <PrivateRoomScreen roomCode={multiplayerState.roomCode} setCurrentScreen={setCurrentScreen} />;
            case 'multiplayerQuiz': return <MultiplayerQuizScreen state={multiplayerState} />;
            case 'multiplayerResult': return <MultiplayerResultScreen state={multiplayerState} setCurrentScreen={setCurrentScreen} />;
            default: return <LoginScreen onLogin={handleLogin} showToast={showToast} setCurrentScreen={setCurrentScreen}/>;
        }
    };

    // A estrutura JSX principal da aplicação.
    return (
        <main>
            <Toast {...toast} />
            <button id="toggleThemeBtn" className="theme-toggle-btn" onClick={() => setTheme(p => p === 'dark' ? 'royal-library' : 'dark')}>
                {theme === 'dark' ? '📜' : '🌙'}
            </button>
            <h1 className="quiz-title">QUIZ<span> 1ADS</span></h1>
            <h2 className="quiz-desc">Teste seu conhecimento!</h2>
            <p className="quiz-desc2">Responda as perguntas e veja sua pontuação.</p>
            <div className="auth-container"><div id="authCard" className="auth-card">{renderScreen()}</div></div>
        </main>
    );
}

// --- Componentes de Tela ---

// Componente para a tela de Login e Registo.
function LoginScreen({ onLogin, showToast, setCurrentScreen }) {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nome, setNome] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!nome || !email || !password) { showToast("Preencha todos os campos.", false); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome, email, senha: password })
            });
            const data = await res.json();
            if (res.ok) {
                showToast("Registo feito! Faça o login.", true);
                setIsRegister(false);
            } else { showToast(data.erro || "Erro no registo.", false); }
        } catch { showToast("Erro de conexão.", false);
        } finally { setLoading(false); }
    };

    const handleSubmit = (e) => {
        e.preventDefault(); setLoading(true);
        if (isRegister) { handleRegister().finally(() => setLoading(false)); } 
        else { onLogin(email, password).finally(() => setLoading(false)); }
    };

    return (
        <section className="screen active">
            <h2>{isRegister ? 'Criar Conta' : 'Login'}</h2>
            <form onSubmit={handleSubmit} className="input-group">
                {isRegister && <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" className="auth-input" required />}
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="auth-input" required autoComplete="email"/>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="auth-input" required autoComplete={isRegister ? "new-password" : "current-password"}/>
                {!isRegister && <a href="#" onClick={(e) => {e.preventDefault(); setCurrentScreen('forgotPassword')}} className="forgot-password-link">Esqueceu a senha?</a>}
                <button type="submit" className="auth-btn" disabled={loading}>{loading ? 'Aguarde...' : (isRegister ? 'Registar' : 'Entrar')}</button>
                <button type="button" className="auth-btn secondary-btn" onClick={() => setIsRegister(!isRegister)}>
                    {isRegister ? 'Já tenho conta' : 'Criar uma conta'}
                </button>
            </form>
        </section>
    );
}

// Componente para pedir o link de recuperação de senha.
function ForgotPasswordScreen({ showToast, setCurrentScreen }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRequest = async (e) => {
        e.preventDefault(); setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/esqueci-senha`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            showToast(data.mensagem, res.ok);
            if (res.ok) { setCurrentScreen('login'); }
        } catch { showToast("Erro de conexão.", false);
        } finally { setLoading(false); }
    };

    return (
        <section className="screen active">
            <h2>Recuperar Senha</h2>
            <p>Digite o seu e-mail para receber um link de recuperação.</p>
            <form onSubmit={handleRequest} className="input-group">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Seu e-mail" className="auth-input" required />
                <button type="submit" className="auth-btn" disabled={loading}>{loading ? 'A enviar...' : 'Enviar Link'}</button>
                <button type="button" className="auth-btn secondary-btn" onClick={() => setCurrentScreen('login')}>Voltar</button>
            </form>
        </section>
    );
}

// Componente para definir a nova senha.
function ResetPasswordScreen({ showToast, setCurrentScreen }) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleReset = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) { showToast("As senhas não coincidem.", false); return; }
        setLoading(true);
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            const res = await fetch(`${API_URL}/auth/redefinir-senha`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, novaSenha: password })
            });
            const data = await res.json();
            showToast(data.mensagem, res.ok);
            if(res.ok) {
                window.history.pushState({}, '', window.location.pathname);
                setCurrentScreen('login');
            }
        } catch { showToast("Erro de conexão.", false);
        } finally { setLoading(false); }
    };
    
    return (
        <section className="screen active">
            <h2>Criar Nova Senha</h2>
            <p>Digite e confirme a sua nova senha.</p>
            <form onSubmit={handleReset} className="input-group">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nova senha" className="auth-input" required />
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirme a senha" className="auth-input" required />
                <button type="submit" className="auth-btn" disabled={loading}>{loading ? 'A salvar...' : 'Salvar Nova Senha'}</button>
            </form>
        </section>
    );
}

// Componente para a tela principal (Menu).
function ThemeScreen({ user, onGerarQuiz, onQuizAleatorio, dificuldade, setDificuldade, setCurrentScreen }) {
    const [ranking, setRanking] = useState([]);
    const [loadingRanking, setLoadingRanking] = useState(true);
    const [tema, setTema] = useState('');

    useEffect(() => {
        const fetchRanking = async () => {
            setLoadingRanking(true);
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/api/ranking/geral`, { headers: { "Authorization": `Bearer ${token}` } });
                const data = await res.json();
                if (res.ok) setRanking(data.ranking);
            } catch { console.error("Erro ao buscar ranking:");
            } finally { setLoadingRanking(false); }
        };
        fetchRanking();
    }, []);
    
    const getPlayerData = () => ({
        userId: localStorage.getItem('userId'), name: user?.nome,
        elo: parseInt(localStorage.getItem('eloScore'), 10), avatarUrl: localStorage.getItem('avatarUrl')
    });

    const handleFindMatch = () => { socket.emit('findMatch', getPlayerData()); setCurrentScreen('multiplayerWait'); };
    const handleCreateRoom = () => { socket.emit('createPrivateRoom', getPlayerData()); setCurrentScreen('loading'); };
    const handleJoinRoom = () => {
        const roomCode = prompt("Insira o código da sala:");
        if (roomCode) {
            socket.emit('joinPrivateRoom', { ...getPlayerData(), roomCode: roomCode.trim().toUpperCase() });
            setCurrentScreen('loading');
        }
    };
    
    return (
        <section className="screen active">
            <h2 id="welcome-text">Olá, {user?.nome}!</h2>
            <button onClick={() => setCurrentScreen('profile')} className="quiz-btn secondary-btn">Meu Perfil</button>
             <div className="difficulty-selector">
                {['Fácil', 'Médio', 'Difícil'].map(d => <button key={d} className={`difficulty-btn ${dificuldade === d ? 'active' : ''}`} onClick={() => setDificuldade(d)}>{d}</button>)}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); onGerarQuiz(tema); }} className="input-group">
                <input type="text" value={tema} onChange={e => setTema(e.target.value)} placeholder="Digite um tema" className="auth-input" />
                <button type="submit" className="quiz-btn">Gerar Quiz</button>
                <button type="button" onClick={onQuizAleatorio} className="quiz-btn">Quiz Aleatório</button>
            </form>
            <div className="input-group-multiplayer">
                <button onClick={handleFindMatch} className="quiz-btn">⚔️ Duelo Público</button>
                <button onClick={handleCreateRoom} className="quiz-btn secondary-btn">Criar Sala</button>
                <button onClick={handleJoinRoom} className="quiz-btn secondary-btn">Entrar em Sala</button>
            </div>
            <h3>🏆 Ranking Global</h3>
            <div className="ranking-box">
                {loadingRanking ? <div className="loader"></div> : (
                    <ol>{ranking?.map((player, index) => <li key={index}><span>{index + 1}. {player.nome}</span> <span>{player.pontuacaoTotal} pts</span></li>)}</ol>
                )}
            </div>
        </section>
    );
}

// Componente para a tela do quiz single-player.
function QuizScreen({ quizData, onFinish, showToast, token }) {
    const [perguntaAtual, setPerguntaAtual] = useState(0);
    const [pontuacao, setPontuacao] = useState(0);
    const [respostaSelecionada, setRespostaSelecionada] = useState('');
    const [respostaRevelada, setRespostaRevelada] = useState(false);
    
    const pergunta = quizData.perguntas[perguntaAtual];

    const handleResposta = (opcao) => {
        if (respostaRevelada) return;
        setRespostaSelecionada(opcao);
        setRespostaRevelada(true);
        if (opcao === pergunta.respostaCorreta) setPontuacao(p => p + 1);
    };

    const proximaPergunta = async () => {
        if (perguntaAtual < quizData.perguntas.length - 1) {
            setPerguntaAtual(p => p + 1);
            setRespostaSelecionada('');
            setRespostaRevelada(false);
        } else {
            showToast(`Quiz finalizado! Pontuação: ${pontuacao}/${quizData.perguntas.length}`, true);
            if (token) {
                try {
                    await fetch(`${API_URL}/api/salvar`, {
                        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`},
                        body: JSON.stringify({ tema: quizData.tema, pontuacao, total: quizData.perguntas.length })
                    });
                } catch {
                    showToast("Erro ao salvar o resultado.", false);
                }
            }
            onFinish();
        }
    };

    return (
        <section className="screen active">
             <div className="quiz-header"><p className="progress-text">{`Pergunta ${perguntaAtual + 1} de ${quizData.perguntas.length}`}</p></div>
             <h3 className="question">{pergunta.pergunta}</h3>
             <div className="options-container">
                {pergunta.opcoes.map((opcao, index) => {
                    let btnClass = 'option-btn';
                    if (respostaRevelada) {
                        if (opcao === pergunta.respostaCorreta) btnClass += ' correct';
                        else if (opcao === respostaSelecionada) btnClass += ' incorrect';
                    }
                    return <button key={index} onClick={() => handleResposta(opcao)} className={btnClass} disabled={respostaRevelada}>{opcao}</button>;
                })}
             </div>
             {respostaRevelada && (
                 <>
                    <div className="explanation-box">{pergunta.explicacao}</div>
                    <button onClick={proximaPergunta} className="quiz-btn">{perguntaAtual < quizData.perguntas.length - 1 ? 'Próxima Pergunta' : 'Finalizar'}</button>
                 </>
             )}
        </section>
    );
}

// Componente para a tela de Perfil do utilizador.
function ProfileScreen({ setCurrentScreen, handleLogout, showToast, token }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedAvatar, setSelectedAvatar] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_URL}/api/perfil`, { headers: { "Authorization": `Bearer ${token}` } });
                const data = await res.json();
                if (res.ok) { setProfile(data); setSelectedAvatar(data.avatarUrl); }
                else showToast("Erro ao carregar perfil", false);
            } catch { showToast("Erro de conexão.", false); } 
            finally { setLoading(false); }
        };
        if(token) fetchProfile();
    }, [token, showToast]);

    const handleSaveAvatar = async () => {
        if (!selectedAvatar) { showToast("Selecione um avatar.", false); return; }
        try {
            const res = await fetch(`${API_URL}/api/perfil/avatar`, {
                method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`},
                body: JSON.stringify({ avatarUrl: selectedAvatar })
            });
            if (res.ok) {
                showToast("Avatar salvo com sucesso!", true);
                localStorage.setItem("avatarUrl", selectedAvatar);
            } else { showToast("Erro ao salvar o avatar.", false); }
        } catch { showToast("Erro de conexão.", false); }
    }

    if (loading) return <LoadingScreen />;
    if (!profile) return <p>Não foi possível carregar o perfil.</p>;

    const avatarOptions = [
        "/Copilot_20250919_120353.png", "/Copilot_20250919_120405.png",
        "/Copilot_20250919_120425.png", "/Copilot_20250919_120619.png",
        "/Copilot_20250919_120746.png", "/Copilot_20250919_121004.png",
        "/Copilot_20250919_121154.png"
    ];

    return (
         <section className="screen active">
            <div className="profile-header">
                <div className="profile-avatar"><Avatar url={selectedAvatar} name={profile.nome} /></div>
                <h2>{profile.nome}</h2>
            </div>
            <h3>🖼️ Personalize seu Avatar</h3>
            <div id="avatar-gallery" className="avatar-gallery">
                {avatarOptions.map(url => (
                    <img key={url} src={url} alt={`Avatar opção`} 
                         className={`avatar-option ${selectedAvatar === url ? 'selected' : ''}`}
                         onClick={() => setSelectedAvatar(url)} />
                ))}
            </div>
            <button onClick={handleSaveAvatar} className="quiz-btn">Salvar Avatar</button>
            <h3>🏅 Estatísticas</h3>
            <div className="profile-stats-grid">
                <div className="stat-box"><StatsIcon /><h4>Quizzes Jogados</h4><p>{profile.stats.totalQuizzes}</p></div>
                <div className="stat-box"><PointsIcon /><h4>Total de Pontos</h4><p>{profile.stats.totalPontos}</p></div>
                <div className="stat-box"><FavoriteIcon /><h4>Tema Favorito</h4><p>{profile.stats.temaFavorito}</p></div>
            </div>
            <div className="input-group">
                <button onClick={handleLogout} className="quiz-btn">Sair</button>
                <button onClick={() => setCurrentScreen('theme')} className="quiz-btn secondary-btn">Voltar</button>
            </div>
        </section>
    );
}

// Componente para a tela de espera do multiplayer.
function MultiplayerWaitScreen({setCurrentScreen}) {
    return (
        <section className="screen active">
            <h2>Procurando um Oponente...</h2><div className="loader"></div>
            <button onClick={() => { socket.emit('cancelMatchmaking'); setCurrentScreen('theme'); }} className="quiz-btn secondary-btn">Cancelar</button>
        </section>
    )
}

// Componente para a tela de sala privada.
function PrivateRoomScreen({roomCode, setCurrentScreen}) {
    return (
        <section className="screen active">
            <h2>Sala Privada Criada!</h2><p>Partilhe este código com o seu amigo:</p>
            <div className="room-code-box">{roomCode}</div>
            <p>A aguardar oponente...</p><div className="loader"></div>
            <button onClick={() => setCurrentScreen('theme')} className="quiz-btn secondary-btn">Cancelar</button>
        </section>
    )
}

// Componente para a tela do quiz multiplayer.
function MultiplayerQuizScreen({state}) {
    const { question, myPlayer, opponentPlayer, roundResult } = state;
    const [respostaEnviada, setRespostaEnviada] = useState(false);

    useEffect(() => {
        setRespostaEnviada(false); // Reinicia a cada nova pergunta
    }, [question]);

    const handleAnswer = (answer) => {
        setRespostaEnviada(true);
        socket.emit('submitAnswer', { room: state.room, answer });
    };

    if (!question) return <LoadingScreen text="A aguardar próxima pergunta..." />;
    
    return (
        <section className="screen active">
            <div className="multiplayer-header">
                <div className="player-info"><div className="player-avatar"><Avatar url={myPlayer.avatarUrl} name={myPlayer.name} /></div><span>{myPlayer.name}</span><span className="score">{roundResult?.scores[myPlayer.socketId] || 0}</span></div>
                <div className="timer">{state.question?.timer}</div>
                <div className="player-info"><div className="player-avatar"><Avatar url={opponentPlayer.avatarUrl} name={opponentPlayer.name} /></div><span>{opponentPlayer.name}</span><span className="score">{roundResult?.scores[opponentPlayer.socketId] || 0}</span></div>
            </div>
            <h3 className="question">{question.pergunta}</h3>
            <div className="options-container">
                {question.opcoes.map((opcao) => {
                    let btnClass = 'option-btn';
                    if (roundResult) {
                        if (opcao === roundResult.correctAnswer) btnClass += ' correct';
                        else if (roundResult.answers && roundResult.answers[myPlayer.socketId] === opcao) btnClass += ' incorrect';
                    }
                    return <button key={opcao} onClick={() => handleAnswer(opcao)} className={btnClass} disabled={respostaEnviada || !!roundResult}>{opcao}</button>
                })}
            </div>
        </section>
    );
}

// Componente para a tela de resultado do multiplayer.
function MultiplayerResultScreen({ state, setCurrentScreen }) {
    const { result, myPlayer } = state;
    const [rematchRequested, setRematchRequested] = useState(false);

    useEffect(() => {
        const handleRematchRequest = () => setRematchRequested(true);
        socket.on('rematchRequestedByOpponent', handleRematchRequest);
        return () => socket.off('rematchRequestedByOpponent', handleRematchRequest);
    }, []);

    if (!result) return <LoadingScreen text="A calcular resultados..." />;

    const myResult = result.players.find(p => p.socketId === myPlayer?.socketId);
    const opponentResult = result.players.find(p => p.socketId !== myPlayer?.socketId);
    let winnerText = "Empate!";
    if (myResult && opponentResult) {
        if (myResult.score > opponentResult.score) winnerText = `🏆 Vencedor: ${myResult.name} 🏆`;
        else if (opponentResult.score > myResult.score) winnerText = `🏆 Vencedor: ${opponentResult.name} 🏆`;
    }

    const myEloChange = result.eloChanges ? result.eloChanges[myPlayer?.socketId] : null;

    return (
        <section className="screen active">
            <h2>Fim do Duelo!</h2>
            <div id="multiplayer-final-results">
                <h3>{winnerText}</h3>
                {myResult && <p>{myResult.name}: {myResult.score} pontos</p>}
                {opponentResult && <p>{opponentResult.name}: {opponentResult.score} pontos</p>}
            </div>
            {myEloChange && (
                <div id="elo-changes">
                    <p>Ranking ELO: {myEloChange.old} → {myEloChange.new} 
                        <span className={myEloChange.new - myEloChange.old >= 0 ? 'elo-gain' : 'elo-loss'}>
                            ({myEloChange.new - myEloChange.old > 0 ? '+' : ''}{myEloChange.new - myEloChange.old})
                        </span>
                    </p>
                </div>
            )}
            <div className="input-group">
                <button onClick={() => socket.emit('requestRematch', { roomName: result.roomName })} 
                        className={`quiz-btn ${rematchRequested ? 'glowing' : ''}`}>
                    Jogar Novamente
                </button>
                <button onClick={() => setCurrentScreen('theme')} className="quiz-btn secondary-btn">Voltar ao Menu</button>
            </div>
        </section>
    );
}

