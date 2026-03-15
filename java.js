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
const playground = createMatrix(15, 15);
let currentShape = null;

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
            // Verificăm dacă celula din piesă este plină
            // Apoi verificăm dacă în playground la acea poziție există ceva sau e marginea
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
                // Transferăm culoarea piesei în matricea fixă a jocului
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
            ++y; // Verificăm același index din nou pentru că rândurile de sus au coborât
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
        playground.forEach(row => row.fill(0));
        score = 0;
        updateScore(0);
    }
}

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
function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > 1000) {
        dropObject(currentShape);
        dropCounter = 0;
    }
    draw();
    requestAnimationFrame(update);
}

window.addEventListener('keydown', e => {
    if (currentShape) moveObject(e, currentShape);
});

resetShape();
update();