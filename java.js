class Shape {
      constructor(matrix,color)
      {
        this.pos = { x: 14, y: 0 };
        this.matrix=matrix;
        this.color=color;
      }
    }
    const T_SHAPE = new Shape([
    [0, 1, 0],
    [1, 1, 1],
],'#f56600');

const RECT_SHAPE = new Shape([
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
],'#71eba4');

const I_SHAPE = new Shape([
    [1],
    [1],
    [1],
    [1],
], '#FF0D72');

const PLUS_SHAPE = new Shape([
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 0],
], '#3877FF');

const LINE_SHAPE = new Shape([
    [1, 1, 1, 1],
], '#FFE138');

const REV_T_SHAPE = new Shape([
    [1, 1, 1],
    [0, 1, 0],
], '#CE8E0D');

const REV_U_SHAPE = new Shape([
    [1, 1, 1],
    [1, 0, 1],
], '#AEA12D');

const J_SHAPE = new Shape([
    [1, 0, 0],
    [1, 1, 1],
], '#109317');

const REV_J_SHAPE = new Shape([
    [1, 1, 1],
    [1, 0, 0],
], '#ABCDEF');

const U_SHAPE = new Shape([
    [1, 0, 1],
    [1, 1, 1],
], '#A011AB');
    const canvas = document.getElementById('tetris');
    const context = canvas.getContext('2d');
    context.scale(10, 5);

    function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
    }

    function drawMatrix(matrix, offset,color) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle=color; 
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
              }
          });
      });
    }
    function returnShape(index)
    {
      const allShapes = [T_SHAPE, RECT_SHAPE, I_SHAPE, PLUS_SHAPE, LINE_SHAPE, REV_T_SHAPE, REV_U_SHAPE, J_SHAPE, REV_J_SHAPE, U_SHAPE];
     
      Temporary=new Shape(allShapes[index].matrix,allShapes[index].color)
    
    return Temporary;
    }
    function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, {x: 0, y: 0});
     index = Math.floor(Math.random() * 10);
     console.log(index);
     const Temporary=returnShape(index);
     console.log(Temporary.matrix)
    drawMatrix(Temporary.matrix, Temporary.pos,Temporary.color);
    }
    const arena = createMatrix(34, 34); 
   
    

draw();