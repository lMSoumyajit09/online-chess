var socket = io();
var board;
var game = new Chess();
var roomCode = null;
var playerColor = null;
var players = [];
var whiteTime = 300;
var blackTime = 300;
var timerInterval = null;

// Create/Join
function createGame() {
    const name = document.getElementById("playerName").value.trim();
    if (!name) { alert("Enter your name"); return; }
    socket.emit("createRoom", { playerName: name });
}
function joinGame() {
    const name = document.getElementById("playerName").value.trim();
    if (!name) { alert("Enter your name"); return; }
    const code = document.getElementById("roomInput").value.trim().toUpperCase();
    if (!code) { alert("Enter room code"); return; }
    socket.emit("joinRoom", { roomCode: code, playerName: name });
}

// Events
socket.on("roomCreated", (data) => { roomCode = data.roomCode; playerColor = data.color; players = data.players; startUI(); });
socket.on("joinedRoom", (data) => { roomCode = data.roomCode; playerColor = data.color; players = data.players; startUI(); });
socket.on("startGame", () => { document.getElementById("status").innerText = "Game Started!"; startTimer(); });
socket.on("move", (data) => { game.load(data.fen); board.position(data.fen); updateCheck(); checkEndGame(); });

// Show comment beside sender on both tabs
socket.on("receiveComment", commentData => {
    showComment(commentData.player, commentData.comment);
});

// Update player names
socket.on("updatePlayers", ({ players }) => {
    const white = players.find(p => p.color === 'white');
    const black = players.find(p => p.color === 'black');
    document.getElementById("whitePlayer").childNodes[0].nodeValue = "White: " + (white ? white.name : "Waiting...");
    document.getElementById("blackPlayer").childNodes[0].nodeValue = "Black: " + (black ? black.name : "Waiting...");
});

// Comments
function sendComment(comment){
    socket.emit("sendComment",{roomCode,comment,player:playerColor});
    showComment(playerColor, comment);
}
function showComment(player, comment){
    let spanId;
    if(player === 'white') spanId = 'whiteComment';
    else if(player === 'black') spanId = 'blackComment';
    else return;
    const el = document.getElementById(spanId);
    el.innerText = comment;
    el.style.opacity = 1;
    el.style.transform = 'translateY(-20px)';
    setTimeout(()=>{
        el.style.opacity = 0;
        el.style.transform = 'translateY(0)';
    },2000);
}

// UI
function startUI(){
    document.getElementById("lobby").style.display="none";
    document.getElementById("game").style.display="block";
    document.getElementById("roomText").innerText="Room: "+roomCode;
    updatePlayerDisplay();
    updateTurnDisplay();
    board=Chessboard("board",{draggable:true,position:game.fen(),orientation:playerColor,onDragStart:onDragStart,onDrop:onDrop,onMouseoverSquare:highlightHoverMoves,onMouseoutSquare:removeHighlights});
}
function updatePlayerDisplay(){
    const white=players.find(p=>p.color==='white');
    const black=players.find(p=>p.color==='black');
    document.getElementById("whitePlayer").childNodes[0].nodeValue="White: "+(white?white.name:"Waiting...");
    document.getElementById("blackPlayer").childNodes[0].nodeValue="Black: "+(black?black.name:"Waiting...");
}

// Drag & Drop
function onDragStart(source,piece){
    if(game.game_over()) return false;
    if((game.turn()==='w' && piece[0]==='b') || (game.turn()==='b' && piece[0]==='w')) return false;
    if((game.turn()==='w' && playerColor!=='white')||(game.turn()==='b' && playerColor!=='black')){ alert("Not your turn!"); return false; }
}
function onDrop(source,target){
    let moveObj={from:source,to:target};
    const piece=game.get(source);
    if(piece && piece.type==='p' && ((piece.color==='w' && target[1]==='8')||(piece.color==='b' && target[1]==='1'))){
        const promotion=prompt("Promote pawn (q,r,b,n):","q"); if(!promotion) return 'snapback'; moveObj.promotion=promotion.toLowerCase();
    }
    const move=game.move(moveObj); if(!move) return 'snapback';
    board.position(game.fen()); updateCheck(); checkEndGame();
    if(move.captured) playHitSound();
    playMoveSound();
    socket.emit("move",{roomCode,move,fen:game.fen()});
    updateTurnDisplay();
}

// Highlight & Check
function removeHighlights(){ document.querySelectorAll('#board .square-55d63').forEach(sq=>sq.classList.remove('highlight-yellow','highlight-red')); }
function highlightSquares(squares){ squares.forEach(sq=>{ const el=document.querySelector('#board .square-'+sq); if(el){ el.classList.add('highlight-yellow'); setTimeout(()=>el.classList.remove('highlight-yellow'),2000); } }); }
function highlightHoverMoves(square){ removeHighlights(); const moves=game.moves({square,verbose:true}); highlightSquares(moves.map(m=>m.to)); }
function updateCheck(){ removeHighlights(); if(game.in_check()){ const kingSquare=game.turn()==='w'?getKingSquare('w'):getKingSquare('b'); const kingEl=document.querySelector('#board .square-'+kingSquare); if(kingEl) kingEl.classList.add('highlight-red'); playCheckSound(); } }
function getKingSquare(color){ const pos=board.position(); for(let sq in pos){ if(pos[sq]===(color==='w'?'wK':'bK')) return sq; } }

// End Game
function checkEndGame(){ if(game.in_checkmate()||game.in_draw()||game.in_stalemate()){ const winner=game.in_checkmate()?(game.turn()==='w'?'Black':'White'):'Draw'; document.getElementById('winnerText').innerText=winner+" Wins!"; document.getElementById('winCard').style.display='block'; stopTimer(); playWinSound(); } }
function closeWinCard(){ document.getElementById('winCard').style.display='none'; }

// Sounds
function playMoveSound(){ const s=document.getElementById('moveSound'); if(s){s.currentTime=0;s.play();} }
function playWinSound(){ const s=document.getElementById('winSound'); if(s){s.currentTime=0;s.play();} }
function playCheckSound(){ const s=document.getElementById('checkSound'); if(s){s.currentTime=0;s.play();} }
function playHitSound(){ const s=document.getElementById('hitSound'); if(s){s.currentTime=0;s.play();} }

// Timer
function startTimer(){ if(timerInterval) clearInterval(timerInterval); timerInterval=setInterval(()=>{ if(game.turn()==='w') whiteTime--; else blackTime--; document.getElementById('whiteTimer').innerText=formatTime(whiteTime); document.getElementById('blackTimer').innerText=formatTime(blackTime); if(whiteTime<=0||blackTime<=0){ checkEndGame(); stopTimer(); } },1000); }
function stopTimer(){ clearInterval(timerInterval); }
function formatTime(t){ const m=Math.floor(t/60),s=t%60; return (m<10?'0':'')+m+":"+(s<10?'0':'')+s; }
function updateTurnDisplay(){ document.getElementById('turnInfo').innerText="Turn: "+(game.turn()==='w'?'White':'Black'); }