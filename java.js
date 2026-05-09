class Shape {
    constructor(matrix, color) {
        this.pos = { x: 6, y: 0 };
        this.matrix = matrix;
        this.color = color;
    }
}

const T_SHAPE = new Shape([[0, 1, 0], [1, 1, 1], [0, 0, 0]], '#f56600');
const RECT_SHAPE = new Shape([[1, 1, 1], [1, 1, 1], [1, 1, 1]], '#71eba4');
const I_SHAPE = new Shape([[1], [1], [1], [1]], '#FF0D72');
const PLUS_SHAPE = new Shape([[0, 1, 0], [1, 1, 1], [0, 1, 0]], '#3877FF');
const LINE_SHAPE = new Shape([[1, 1, 1, 1]], '#FFE138');
const REV_T_SHAPE = new Shape([[1, 1, 1], [0, 1, 0], [0, 0, 0]], '#CE8E0D');
const REV_U_SHAPE = new Shape([[1, 1, 1], [1, 0, 1], [0, 0, 0]], '#AEA12D');
const J_SHAPE = new Shape([[1, 0, 0], [1, 1, 1], [0, 0, 0]], '#109317');
const REV_J_SHAPE = new Shape([[1, 1, 1], [1, 0, 0], [0, 0, 0]], '#ABCDEF');
const U_SHAPE = new Shape([[1, 0, 1], [1, 1, 1], [0, 0, 0]], '#A011AB');

const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d'); //After you have created a 2D context, you can draw on the canvas.
canvas.width = 300;
canvas.height = 300;
context.scale(20, 20); //pentru piesa de tetris
let score = 0;
let isPaused = false;
let gameOverSubmitting = false;
const playground = createMatrix(15, 15);
let currentShape = null;
let currentUser = { userId: null, username: null };
let currentGameMeta = { matriceId: null, matrice_nume: null };
const SAVED_CELL_COLOR = '#3877FF';

async function api(action, payload = null, method = 'POST') {
    const url = method === 'GET'
        ? `db.php?action=${encodeURIComponent(action)}${payload ? '&' + new URLSearchParams(payload).toString() : ''}`
        : `db.php`;

    const res = await fetch(url, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify({ action, ...(payload || {}) }) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
}

function getSavePayload() {
    // În DB salvăm doar 0/1 (1 = există piesă)
    return playground.map(row => row.map(cell => (cell === 0 ? 0 : 1)));
}

function applyLoadedGame(game) {
    // DB returnează 0/1; în UI colorăm 1 cu albastru
    const grid = game.playground;

    if (Array.isArray(grid)) {
        for (let y = 0; y < playground.length; y++) {
            for (let x = 0; x < playground[y].length; x++) {
                playground[y][x] = grid?.[y]?.[x] ? SAVED_CELL_COLOR : 0;
            }
        }
    }
    score = Number(game.scor) || 0;
    const scoreElement = document.getElementById('score');
    if (scoreElement) scoreElement.innerHTML = String(score);

    // La resume nu reconstituim figura exactă; reîncepem cu o piesă nouă
    resetShape();

    isPaused = false;
    startGameLoop();
}

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

//functie de coliziune cu piese sau cu capat de rand
function collide(playground, shape) {
    const [m, o] = [shape.matrix, shape.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
                (playground[y + o.y] && playground[y + o.y][x + o.x]) !== 0) {
                //daca la urmatorul rand se gaseste piesa,adica valoare de 1 
                // sau piesa ajunge la cel mai de jos rand al matricei piese se opreste acolo
                return true;
            }
        }
    }
    return false;
}

//functie de contopire cu alte piese in matricea de playground
function merge(playground, shape) {
    shape.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                playground[y + shape.pos.y][x + shape.pos.x] = shape.color;
            }
        });
    });
}

//functie de mutat piesa la stanga/dreapta/jos
function moveObject(e, shape) {
    if (e.key === 'a') {
        shape.pos.x--;
        if (collide(playground, shape)) shape.pos.x++;
    } else if (e.key === 'd') {
        shape.pos.x++;
        if (collide(playground, shape)) shape.pos.x--;
    } else if (e.key === 's') {
        dropObject(shape);
    }
}

function dropObject(shape) {
    if (shape.pos.y === 0) { //daca piesa este noua adica pleaca de sus atunci se adauga +10 la scor
        updateScore(10);
    }
    shape.pos.y++;
    if (collide(playground, shape)) {
        shape.pos.y--;
        merge(playground, shape);
        removeRow(playground);
        removeColumn(playground);
        resetShape();
    }
}

//functie de remove row atunci cand piesele se contopesc pe un rand,
// adica sunt doar valori de 1 pe acel rand atunci se sterg valorile de 1 
// si dispar piesele de pe acea linie iar piesele de sus cad in linia goala creata sa ocupe spatiul
function removeRow(playground) {
    for (let y = playground.length - 1; y >= 0; --y) {
        let full = true;
        for (let x = 0; x < playground[y].length; ++x) {
            if (playground[y][x] === 0) {
                full = false;
                break;
            }
        }
        if (full) {
            const row = playground.splice(y, 1)[0].fill(0);
            playground.unshift(row);
            ++y; 
            updateScore(100);
        }
    }
}

//la fel ca la removeRow doar ca se sterge coloana care are doar valori de 1 
// dar piesele nu se muta la stanga  sau la dreapta
function removeColumn(playground) {
    const w = playground[0].length;
    const h = playground.length;
    for (let x = 0; x < w; x++) {
        let full = true;
        for (let y = 0; y < h; y++) {
            if (playground[y][x] === 0) {
                full = false;
                break;
            }
        }
        if (full) {
            for (let y = 0; y < h; y++) {
                playground[y][x] = 0;
            }
            updateScore(100);
        }
    }
}

//functie de overflow,daca piesa care isi da spawn nu mai are loc atunci functia returneaza true si jocul e terminat
function endGame(playground, shape) {
    if (collide(playground, shape)) {
        isPaused = true;
        stopGameLoop();
        if (gameOverSubmitting) return;
        gameOverSubmitting = true;

        // Cerință: la Game Over NU mai oferim opțiunea de Save.
        // Dacă e New Game (nu avem matriceId), permitem introducerea numelui (prompt simplu).
        let name = currentGameMeta.matrice_nume;
        if (!currentGameMeta.matriceId) {
            name = (prompt('Game over! Scrie un nume pentru joc (Game name):') || '').trim();
            // Dacă user anulează, tot continuăm fără nume (nu salvăm în logs oricum).
        }

        api('submit_game_over', {
            scor: score,
            matriceId: currentGameMeta.matriceId || 0,
            // name e doar pentru UI/viitor; backend-ul acum salvează doar scor + userId în leaderboard
            matrice_nume: name || null,
        })
            .then((r) => {
                // opțional: poți afișa un mesaj
                // console.log('Game over submitted. inserted=', r.inserted);
            })
            .catch((err) => {
                console.error('submit_game_over failed:', err);
            })
            .finally(() => {
                // Reset joc
                playground.forEach(row => row.fill(0));
                score = 0;
                updateScore(0);
                isPaused = false;
                currentGameMeta = { matriceId: null, matrice_nume: null };
                gameOverSubmitting = false;
                resetShape();
                startGameLoop();
            });
    }
}

// finalizeGameOverAfterSaveDialog a fost eliminat: la Game Over nu mai există dialog de salvare.

function updateScore(update) {
    score += update;
    const scoreElement = document.getElementById('score');
    if (scoreElement) scoreElement.innerHTML = score;
}

//functie de desenare piese 
function drawShape(matrix, offset, color) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = color || value;
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

//functia de spawn pt piesa in timpul jocului,returneaza in functie de index
function returnShape(index) {
    const allShapes = [T_SHAPE, RECT_SHAPE, I_SHAPE, PLUS_SHAPE, LINE_SHAPE, REV_T_SHAPE, REV_U_SHAPE, J_SHAPE, REV_J_SHAPE, U_SHAPE];
    const original = allShapes[index];
    return new Shape(original.matrix, original.color);
}

function resetShape() {
    const index = Math.floor(Math.random() * 10);
    currentShape = returnShape(index);
    endGame(playground, currentShape);
}

function draw() {
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawShape(playground, { x: 0, y: 0 });
    drawShape(currentShape.matrix, currentShape.pos, currentShape.color);
}

let dropCounter = 0;
let lastTime = 0;
let rafId = null;
let gameLoopRunning = false;

function startGameLoop() {
    if (gameLoopRunning) return;
    gameLoopRunning = true;
    lastTime = 0;
    dropCounter = 0;
    rafId = requestAnimationFrame(update);
}

function stopGameLoop() {
    gameLoopRunning = false;
    if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
}
function update(time = 0) {
    if (!gameLoopRunning) return;
    const deltaTime = time - lastTime;
    lastTime = time;

    if (isPaused) {
        draw(); 
        rafId = requestAnimationFrame(update);
        return; 
    }

    dropCounter += deltaTime;
    if (dropCounter > 1000) {
        dropObject(currentShape);
        dropCounter = 0;
    }

    draw();
    rafId = requestAnimationFrame(update);
}

window.addEventListener('keydown', e => {
    if (isPaused) return; 
    if (currentShape) {
        moveObject(e, currentShape);
    }
});
//pentru butonul de X 
const resetBtn = document.getElementById('home');
resetBtn.addEventListener('click', () => {
     // Când închizi jocul și apare save dialog, jocul nu trebuie să mai ruleze în fundal
     isPaused = true;
     stopGameLoop();

     // Dacă jocul e deschis din Continue (are matriceId), facem autosave pe același joc și ieșim fără dialog.
     if (currentGameMeta.matriceId) {
         api('update_game', {
             matriceId: currentGameMeta.matriceId,
             scor: score,
             playground: getSavePayload(),
         })
             .catch((err) => console.error('Autosave failed:', err));

         // închide popover-ul jocului
         const gamePopover = document.getElementById('new_game');
         if (gamePopover && typeof gamePopover.hidePopover === 'function') {
             gamePopover.hidePopover();
         }
         document.getElementById("main_background").classList.remove("main--dimmed");
         currentGameMeta = { matriceId: null, matrice_nume: null };
         return;
     }

     // Altfel: flow normal (întreabă dacă vrei să salvezi)
     document.getElementById("title_text").style.display="block";
     const saveEl = document.getElementById("save_the_game");
     if (saveEl && typeof saveEl.showPopover === 'function') {
         saveEl.showPopover();
     } else if (saveEl) {
         saveEl.style.display="flex";
     }
     const saveScoreEl = document.getElementById('save_score_value');
     if (saveScoreEl) saveScoreEl.textContent = String(score);
     document.getElementById("main_background").classList.add("main--dimmed");
});

//pentru butonul de new_game
const newGame = document.getElementById('new_game1');
newGame.addEventListener('click', () => {
    playground.forEach(row => row.fill(0));
    score = 0;
    updateScore(0);
    resetShape();
     document.getElementById("title_text").style.display="none";
     currentGameMeta = { matriceId: null, matrice_nume: null };
     
});
//pentru butonul de continue
const continuegame = document.getElementById('continuegame');
continuegame.addEventListener('click', () => {
     document.getElementById("title_text").style.display="none";
     api('list_logs', null, 'GET')
         .then((data) => {
             const logPage = document.getElementById('log-page');
             if (!logPage) return;
             logPage.innerHTML = '';

             (data.logs || []).forEach((row) => {
                 const item = document.createElement('div');
                 item.className = 'log-item';
                 item.style.cursor = 'pointer';
                 item.dataset.matriceId = row.matriceId;
                 item.innerHTML = `
                    <span class="text_lc">${row.matrice_nume}</span>
                    <span class="text_lc date_lc">${row.timestamp}</span>
                    <span class="text_lc">${row.scor}</span>
                 `;
                 item.addEventListener('click', () => {
                     const id = item.dataset.matriceId;
                     api('load_game', { matriceId: id }, 'GET')
                         .then((g) => {
                             // deschide popover-ul jocului și aplică state-ul
                             const gamePopover = document.getElementById('new_game');
                             if (gamePopover && typeof gamePopover.showPopover === 'function') {
                                 gamePopover.showPopover();
                             }
                             currentGameMeta = { matriceId: g.game.matriceId, matrice_nume: g.game.matrice_nume };
                             applyLoadedGame(g.game);
                         })
                         .catch((err) => alert(err.message || 'Eroare load game'));
                 });
                 logPage.appendChild(item);
             });
         })
         .catch((err) => {
             console.error(err);
             // dacă user nu e logat, rămâi pe splash
         });
});
//pentru butonul de leaderboard
const leaderboard = document.getElementById('leader_board');
leaderboard.addEventListener('click', () => {
     document.getElementById("title_text").style.display="none";
     api('leaderboard_top10', null, 'GET')
         .then((data) => {
             const lead = document.getElementById('lead_list');
             if (!lead) return;
             lead.innerHTML = `
                <span class="text_lc">Place</span>
                <span class="text_lc">Username</span>
                <span class="text_lc">Score</span>
             `;
             (data.top || []).forEach((row, idx) => {
                 const place = document.createElement('span');
                 place.className = 'text_lc';
                 place.textContent = String(idx + 1);

                 const user = document.createElement('span');
                 user.className = 'text_lc';
                 user.textContent = row.username;

                 const scor = document.createElement('span');
                 scor.className = 'text_lc';
                 scor.textContent = String(row.scor);

                 lead.appendChild(place);
                 lead.appendChild(user);
                 lead.appendChild(scor);
             });
         })
         .catch((err) => console.error(err));
});
// NOTĂ: nu ascundem titlul la click în containerul multiplayer.
// Click-ul pe X (home3) se propagă și ar ascunde titlul “Welcome...”.
const home3 = document.getElementById('home3');
home3.addEventListener('click', (e) => {
     e.stopPropagation();
     document.getElementById("multiplayer").style.display="none";
     const title = document.getElementById("title_text");
     if (title) title.style.display = "block";
});

//save your progress
//agree to save
const agree = document.getElementById('agree_the_save');
agree.addEventListener('click', () => {
    const gameNameEl = document.getElementById("save_game_name_input");
    const matrice_nume = gameNameEl ? gameNameEl.value.trim() : '';
    if (!matrice_nume) {
        alert("Scrie un nume pentru joc (Game name).");
        return;
    }

    api('save_game', {
        matrice_nume,
        scor: score,
        playground: getSavePayload(),
    })
        .then((data) => {
            console.log("Salvat:", data);
            // joc nou salvat -> devine “joc curent”
            currentGameMeta = { matriceId: data.matriceId, matrice_nume };
        })
        .catch((err) => {
            alert(err.message || "Eroare la salvare");
        });
    // pe Game Over nu mai ajungem aici
     const saveEl = document.getElementById("save_the_game");
     if (saveEl && typeof saveEl.hidePopover === 'function') {
         saveEl.hidePopover();
     } else if (saveEl) {
         saveEl.style.display="none";
     }
     document.getElementById("main_background").classList.remove("main--dimmed");
});
//canceling the saving progress
const dissagree = document.getElementById('cancel_the_save');
dissagree.addEventListener('click', () => {
    //just exit
    // pe Game Over nu mai ajungem aici
     const saveEl = document.getElementById("save_the_game");
     if (saveEl && typeof saveEl.hidePopover === 'function') {
         saveEl.hidePopover();
     } else if (saveEl) {
         saveEl.style.display="none";
     }
     document.getElementById("main_background").classList.remove("main--dimmed");
});

function syncHomepageWithPopovers() {
    const ids = ['new_game', 'continue_game', 'leaderboard', 'multiplayer'];
    const anyOpen = ids.some((id) => {
        const el = document.getElementById(id);
        return el && el.matches(':popover-open');
    });
    const content = document.getElementById('content');
    const title = document.getElementById('title_text');
    if (content) content.classList.toggle('content--hidden', anyOpen);
    if (title) title.style.display = anyOpen ? 'none' : '';
}

['new_game', 'continue_game', 'leaderboard', 'multiplayer'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('toggle', () => {
        syncHomepageWithPopovers();
    });
});

document.getElementById('main_background').classList.add('main--dimmed');

resetShape();
startGameLoop();
 
const multiplayerbtn = document.getElementById('multiplayerbtn');
multiplayerbtn.addEventListener('click', () => {
    document.getElementById("multiplayer").style.display="flex";
});

//play button function pt new_game
const allPlayButtons = document.querySelectorAll('.play_button');
allPlayButtons.forEach(btn => {
    btn.addEventListener('click', () => {
    if (gameOverSubmitting) return;
    isPaused = !isPaused; 
    btn.classList.toggle("paused", isPaused);
    btn.innerText = isPaused ? "START" : "STOP";
    });
});

 const submit = document.getElementById("username_btn");
submit.addEventListener('click', () => {
    const usernameInput = document.getElementById("splash_username_input");
    const passwordInput = document.getElementById("splash_password_input");
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (username === "" || username.length < 4) {
        alert("Introduceti un nume de utilizator cu cel putin 4 caractere!");
        return;
    }
    if (password === "" || password.length < 4) {
        alert("Introduceti o parola cu cel putin 4 caractere!");
        return;
    }

    api('auth', { username, password })
        .then((data) => {
            currentUser = { userId: data.userId, username: data.username };
            const userEl = document.getElementById("username");
            if (userEl) userEl.textContent = data.username;
            closeSplashScreen();
            document.getElementById("main_background").classList.remove("main--dimmed");
        })
        .catch((err) => {
            alert(err.message || "Eroare la autentificare");
        });
});

function closeSplashScreen() {
  document.getElementById("splashscreen").style.display = "none";
  const saveEl = document.getElementById("save_the_game");
  if (saveEl && typeof saveEl.hidePopover === 'function') {
      saveEl.hidePopover();
  } else if (saveEl) {
      saveEl.style.display="none";
  }
  document.getElementById("multiplayer").style.display="none";
}

function alertUserInput() {
    // păstrată doar ca utilitar, dar autentificarea reală e în api('auth')
    const inputElement = document.getElementById("splash_username_input");
    const username = inputElement ? inputElement.value.trim() : '';
    if (username === "" || username.length < 4) {
        alert("Introduceti un nume de utilizator cu cel putin 4 caractere!");
        return true;
    }
    return false;
}
function addLogToPage(gameName, score, timestamp) {
    const container = document.getElementById('logs-container');
    const logItem = document.createElement('div');
    logItem.className = 'log-item';
    logItem.innerHTML = `
        <h4>${gameName}</h4>
        <p><strong>Scor:</strong> ${score}</p>
        <p><small>${timestamp}</small></p>
    `;

    container.prepend(logItem);
}


// addLogToPage("Tetris Retro", 1500, new Date().toLocaleString());

function send_score() {
}
function receive_game()
{

}