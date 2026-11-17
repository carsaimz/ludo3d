/** LUDO 3D - i18n: Portuguese (default), English, Spanish and French. */

export type Lang = 'pt' | 'en' | 'es' | 'fr';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'pt', label: 'Português' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' }
];

type Dict = Record<string, string>;

const pt: Dict = {
  tagline: 'O clássico Ludo em 3D realista. Jogue local, contra bots ou online com amigos.',
  playLocal: 'Passar e jogar',
  playBots: 'Contra o computador',
  playOnline: 'Online (P2P)',
  settings: 'Ajustes',
  howToPlay: 'Como jogar',
  localPlayers: 'Jogadores locais',
  botsCount: 'Número de bots',
  start: 'Começar',
  back: 'Voltar',
  roll: 'Jogar dado',
  rolling: 'Rolando...',
  yourTurn: 'Sua vez',
  turnOf: 'Vez de',
  extraTurn: 'Rodada extra!',
  noMoves: 'Sem movimentos possíveis',
  mustRoll6: 'Tire 6 para sair da base',
  threeSixes: 'Três seis seguidos: passou a vez!',
  selectToken: 'Escolha uma peça',
  captured: 'Capturou',
  tokenHome: 'Peça chegou em casa!',
  youWin: 'Você venceu!',
  gameWon: 'venceu o jogo!',
  paused: 'Pausado',
  resume: 'Continuar',
  restart: 'Reiniciar',
  exit: 'Sair do jogo',
  playAgain: 'Jogar de novo',
  mainMenu: 'Menu principal',
  language: 'Idioma',
  yourName: 'Seu nome',
  namePlaceholder: 'Jogador',
  sound: 'Som',
  autoCamera: 'Câmera automática',
  createRoom: 'Criar sala',
  joinRoom: 'Entrar em sala',
  roomCode: 'Código da sala',
  copied: 'Código copiado!',
  connecting: 'Conectando...',
  waitingPlayers: 'Aguardando jogadores...',
  waitingHost: 'Aguardando o anfitrião iniciar...',
  seats: 'Jogadores na sala',
  fillBots: 'Preencher vagas com bots',
  hostLeft: 'O anfitrião saiu da sala',
  peerLeft: 'Um jogador saiu (agora é um bot)',
  connected: 'Conectado!',
  joinFail: 'Não foi possível conectar. Confira o código.',
  you: 'Você',
  host: 'Anfitrião',
  bot: 'Bot',
  ranks: 'Classificação',
  place: 'lugar',
  how1: 'Tire 6 no dado para tirar uma peça da sua base.',
  how2: 'Tire 6, capture uma peça inimiga ou leve uma peça para casa para jogar de novo.',
  how3: 'Casas com estrela e casas de saída são seguras: ninguém pode capturar ali.',
  how4: 'Precisa do número exato para entrar em casa. Vence quem levar as 4 peças primeiro.',
  how5: 'No modo online P2P, crie uma sala e compartilhe o código com seus amigos.',
  botName: 'CPU',
  player: 'Jogador',
  turnRoll: 'toque para rolar',
  turnPick: 'escolha uma peça',
  turnWait: 'aguarde...',
  winner: 'Campeão',
  betaNote: 'Beta'
};

const en: Dict = {
  tagline: 'The classic Ludo in realistic 3D. Play local, against bots or online with friends.',
  playLocal: 'Pass & play',
  playBots: 'Vs computer',
  playOnline: 'Online (P2P)',
  settings: 'Settings',
  howToPlay: 'How to play',
  localPlayers: 'Local players',
  botsCount: 'Number of bots',
  start: 'Start',
  back: 'Back',
  roll: 'Roll dice',
  rolling: 'Rolling...',
  yourTurn: 'Your turn',
  turnOf: "Turn:",
  extraTurn: 'Extra turn!',
  noMoves: 'No possible moves',
  mustRoll6: 'Roll a 6 to leave the base',
  threeSixes: 'Three sixes in a row: turn forfeited!',
  selectToken: 'Pick a token',
  captured: 'Captured',
  tokenHome: 'Token reached home!',
  youWin: 'You win!',
  gameWon: 'won the game!',
  paused: 'Paused',
  resume: 'Resume',
  restart: 'Restart',
  exit: 'Leave game',
  playAgain: 'Play again',
  mainMenu: 'Main menu',
  language: 'Language',
  yourName: 'Your name',
  namePlaceholder: 'Player',
  sound: 'Sound',
  autoCamera: 'Auto camera',
  createRoom: 'Create room',
  joinRoom: 'Join room',
  roomCode: 'Room code',
  copied: 'Code copied!',
  connecting: 'Connecting...',
  waitingPlayers: 'Waiting for players...',
  waitingHost: 'Waiting for the host to start...',
  seats: 'Players in room',
  fillBots: 'Fill seats with bots',
  hostLeft: 'The host left the room',
  peerLeft: 'A player left (now a bot)',
  connected: 'Connected!',
  joinFail: 'Could not connect. Check the code.',
  you: 'You',
  host: 'Host',
  bot: 'Bot',
  ranks: 'Ranking',
  place: 'place',
  how1: 'Roll a 6 to bring a token out of your base.',
  how2: 'A 6, a capture or a token reaching home grants another roll.',
  how3: 'Star squares and start squares are safe: nobody can capture there.',
  how4: 'You need the exact number to enter home. First to bring all 4 tokens home wins.',
  how5: 'In online P2P mode, create a room and share the code with your friends.',
  botName: 'CPU',
  player: 'Player',
  turnRoll: 'tap to roll',
  turnPick: 'pick a token',
  turnWait: 'wait...',
  winner: 'Champion',
  betaNote: 'Beta'
};

const es: Dict = {
  tagline: 'El clásico Ludo en 3D realista. Juega local, contra bots o en línea con amigos.',
  playLocal: 'Pasar y jugar',
  playBots: 'Contra la computadora',
  playOnline: 'En línea (P2P)',
  settings: 'Ajustes',
  howToPlay: 'Cómo jugar',
  localPlayers: 'Jugadores locales',
  botsCount: 'Número de bots',
  start: 'Empezar',
  back: 'Volver',
  roll: 'Tirar dado',
  rolling: 'Tirando...',
  yourTurn: 'Tu turno',
  turnOf: 'Turno de',
  extraTurn: '¡Turno extra!',
  noMoves: 'Sin movimientos posibles',
  mustRoll6: 'Saca un 6 para salir de la base',
  threeSixes: '¡Tres seis seguidos: pierdes el turno!',
  selectToken: 'Elige una ficha',
  captured: 'Capturó',
  tokenHome: '¡La ficha llegó a casa!',
  youWin: '¡Ganaste!',
  gameWon: 'ganó el juego!',
  paused: 'Pausa',
  resume: 'Continuar',
  restart: 'Reiniciar',
  exit: 'Salir del juego',
  playAgain: 'Jugar de nuevo',
  mainMenu: 'Menú principal',
  language: 'Idioma',
  yourName: 'Tu nombre',
  namePlaceholder: 'Jugador',
  sound: 'Sonido',
  autoCamera: 'Cámara automática',
  createRoom: 'Crear sala',
  joinRoom: 'Unirse a sala',
  roomCode: 'Código de la sala',
  copied: '¡Código copiado!',
  connecting: 'Conectando...',
  waitingPlayers: 'Esperando jugadores...',
  waitingHost: 'Esperando que el anfitrión empiece...',
  seats: 'Jugadores en la sala',
  fillBots: 'Llenar plazas con bots',
  hostLeft: 'El anfitrión salió de la sala',
  peerLeft: 'Un jugador salió (ahora es un bot)',
  connected: '¡Conectado!',
  joinFail: 'No se pudo conectar. Verifica el código.',
  you: 'Tú',
  host: 'Anfitrión',
  bot: 'Bot',
  ranks: 'Clasificación',
  place: 'lugar',
  how1: 'Saca un 6 para sacar una ficha de tu base.',
  how2: 'Un 6, una captura o llevar una ficha a casa te da otro turno.',
  how3: 'Las casillas con estrella y las de salida son seguras: nadie puede capturar ahí.',
  how4: 'Necesitas el número exacto para entrar en casa. Gana quien lleve sus 4 fichas primero.',
  how5: 'En el modo en línea P2P, crea una sala y comparte el código con tus amigos.',
  botName: 'CPU',
  player: 'Jugador',
  turnRoll: 'toca para tirar',
  turnPick: 'elige una ficha',
  turnWait: 'espera...',
  winner: 'Campeón',
  betaNote: 'Beta'
};

const fr: Dict = {
  tagline: 'Le Ludo classique en 3D réaliste. Jouez en local, contre des bots ou en ligne.',
  playLocal: 'Passer et jouer',
  playBots: 'Contre l’ordinateur',
  playOnline: 'En ligne (P2P)',
  settings: 'Réglages',
  howToPlay: 'Comment jouer',
  localPlayers: 'Joueurs locaux',
  botsCount: 'Nombre de bots',
  start: 'Commencer',
  back: 'Retour',
  roll: 'Lancer le dé',
  rolling: 'Lancer...',
  yourTurn: 'À vous',
  turnOf: 'Tour de',
  extraTurn: 'Tour bonus !',
  noMoves: 'Aucun mouvement possible',
  mustRoll6: 'Faites un 6 pour sortir de la base',
  threeSixes: 'Trois 6 de suite : tour perdu !',
  selectToken: 'Choisissez un pion',
  captured: 'A capturé',
  tokenHome: 'Pion rentré à la maison !',
  youWin: 'Vous avez gagné !',
  gameWon: 'a gagné la partie !',
  paused: 'Pause',
  resume: 'Reprendre',
  restart: 'Recommencer',
  exit: 'Quitter la partie',
  playAgain: 'Rejouer',
  mainMenu: 'Menu principal',
  language: 'Langue',
  yourName: 'Votre nom',
  namePlaceholder: 'Joueur',
  sound: 'Son',
  autoCamera: 'Caméra automatique',
  createRoom: 'Créer une salle',
  joinRoom: 'Rejoindre une salle',
  roomCode: 'Code de la salle',
  copied: 'Code copié !',
  connecting: 'Connexion...',
  waitingPlayers: 'En attente de joueurs...',
  waitingHost: 'En attente du lancement par l’hôte...',
  seats: 'Joueurs dans la salle',
  fillBots: 'Compléter avec des bots',
  hostLeft: 'L’hôte a quitté la salle',
  peerLeft: 'Un joueur est parti (désormais un bot)',
  connected: 'Connecté !',
  joinFail: 'Connexion impossible. Vérifiez le code.',
  you: 'Vous',
  host: 'Hôte',
  bot: 'Bot',
  ranks: 'Classement',
  place: 'place',
  how1: 'Faites un 6 pour sortir un pion de votre base.',
  how2: 'Un 6, une capture ou un pion rentré offre un lancer de plus.',
  how3: 'Les cases étoilées et les cases de départ sont sûres : aucune capture.',
  how4: 'Le nombre exact est requis pour rentrer. Le premier à rentrer ses 4 pions gagne.',
  how5: 'En ligne (P2P), créez une salle et partagez le code avec vos amis.',
  botName: 'CPU',
  player: 'Joueur',
  turnRoll: 'touchez pour lancer',
  turnPick: 'choisissez un pion',
  turnWait: 'patientez...',
  winner: 'Champion',
  betaNote: 'Beta'
};

const DICTS: Record<Lang, Dict> = { pt, en, es, fr };

let current: Lang = 'pt';

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem('ludo3d.lang') as Lang | null;
    if (saved && DICTS[saved]) return saved;
    const nav = (navigator.language || 'pt').toLowerCase();
    if (nav.startsWith('pt')) return 'pt';
    if (nav.startsWith('es')) return 'es';
    if (nav.startsWith('fr')) return 'fr';
  } catch {
    /* ignore */
  }
  return 'en';
}

export function setLang(l: Lang): void {
  current = DICTS[l] ? l : 'en';
  try {
    localStorage.setItem('ludo3d.lang', current);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = current;
}

export function getLang(): Lang {
  return current;
}

export function t(key: string, vars?: Record<string, string>): string {
  let s = DICTS[current][key] ?? DICTS.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  }
  return s;
}

export function initI18n(): void {
  current = detectLang();
  document.documentElement.lang = current;
}

export function applyStaticI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const k = el.dataset.i18n;
    if (k) el.textContent = t(k);
  });
  const inp = root.querySelector<HTMLInputElement>('#inp-name');
  if (inp) inp.placeholder = t('namePlaceholder');
}
