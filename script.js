const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const recordsList = document.getElementById("recordsList");
const speedSelect = document.getElementById("speedSelect");
const wallSelect = document.getElementById("wallSelect");
const resetBtn = document.getElementById("resetBtn");

const gridSize = 20;
const tileCount = canvas.width / gridSize;

let snake = [{ x: 10, y: 10 }];
let foods = [];
let dx = 0;
let dy = 0;
let score = 0;

let highScores = JSON.parse(localStorage.getItem("snakeHighScores")) || [
    { name: "Пусто", score: 0 },
    { name: "Пусто", score: 0 },
    { name: "Пусто", score: 0 },
    { name: "Пусто", score: 0 },
    { name: "Пусто", score: 0 }
];

let gameSpeed = parseInt(speedSelect.value);
let wallMode = wallSelect.value;
let gameTimeoutId = null;
let intervals = [];
let isGameOver = false;
let audioCtx = null;

updateLeaderboardUI();

const bananaImage = new Image ();
bananaImage.src = 'icon/banana.svg';

const goldImage = new Image ();
goldImage.src = 'icon/apple.svg'

const whiteImage = new Image ();
whiteImage.src = 'icon/seafood.svg'

const redImage = new Image ();
redImage.src = 'icon/amanita.svg'

const FOOD_TYPES = {
    BLUE: { color: "#007BFF", image: bananaImage, score: 10, growth: 1, type: 'blue', lifetime: 5000 },
    GOLD: { color: "#FFD700", image: goldImage, score: 50, growth: 10, type: 'gold', lifetime: 3000 },
    WHITE: { color: "#FFFFFF", image: whiteImage, score: 25, growth: 5, type: 'white', lifetime: 3000 },
    RED: { color: "#FF5252", image: redImage, score: -30, growth: -7, type: 'red', lifetime: 5000 }
};

speedSelect.addEventListener("change", () => { gameSpeed = parseInt(speedSelect.value); blurControls(); });
wallSelect.addEventListener("change", () => { wallMode = wallSelect.value; blurControls(); });
resetBtn.addEventListener("click", () => { initAudio(); resetGame(); blurControls(); });

function blurControls() {
    speedSelect.blur();
    wallSelect.blur();
    resetBtn.blur();
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(frequency, type, duration, vol) {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.log("Ошибка аудио:", e);
    }
}

const SOUNDS = {
    blue: () => playSound(523.25, 'triangle', 0.15, 0.3),
    white: () => {
        playSound(587.33, 'triangle', 0.1, 0.3);
        setTimeout(() => playSound(698.46, 'triangle', 0.1, 0.3), 80);
    },
    gold: () => {
        playSound(523.25, 'sine', 0.1, 0.4);
        setTimeout(() => playSound(659.25, 'sine', 0.1, 0.4), 70);
        setTimeout(() => playSound(783.99, 'sine', 0.1, 0.4), 140);
        setTimeout(() => playSound(1046.50, 'sine', 0.2, 0.4), 210);
    },
    red: () => {
        playSound(220, 'sawtooth', 0.3, 0.2);
        setTimeout(() => playSound(146.83, 'sawtooth', 0.2, 0.2), 100);
    },
    cut: () => {
        playSound(180, 'square', 0.15, 0.2);
        setTimeout(() => playSound(110, 'square', 0.15, 0.2), 70);
    },
    fail: () => {
        playSound(300, 'sawtooth', 0.2, 0.3);
        setTimeout(() => playSound(200, 'sawtooth', 0.2, 0.3), 150);
        setTimeout(() => playSound(130, 'sawtooth', 0.4, 0.4), 300);
    }
};

function startFoodSpawners() {
    stopFoodSpawners();
    intervals.push(setInterval(() => spawnTimedFood(FOOD_TYPES.GOLD), 15000));
    intervals.push(setInterval(() => spawnTimedFood(FOOD_TYPES.WHITE), 7500));
    intervals.push(setInterval(() => spawnTimedFood(FOOD_TYPES.RED), 1000));
}

function stopFoodSpawners() {
    intervals.forEach(clearInterval);
    intervals = [];
}

function spawnTimedFood(foodType) {
    if ((dx === 0 && dy === 0) || isGameOver) return;

    const exists = foods.some(f => f.config.type === foodType.type);
    if (exists) return;

    const newFood = generateFoodCoords();
    newFood.config = foodType;
    foods.push(newFood);

    setTimeout(() => {
        const index = foods.indexOf(newFood);
        if (index > -1) foods.splice(index, 1);
    }, foodType.lifetime);
}

function checkAndSpawnBlueFood() {
    if (isGameOver || (dx === 0 && dy === 0)) return;

    const blueFood = foods.find(f => f.config.type === 'blue');
    if (!blueFood) {
        spawnTimedFood(FOOD_TYPES.BLUE);
    }
}

function generateFoodCoords() {
    let coords;
    let onSnakeOrFood;
    do {
        onSnakeOrFood = false;
        coords = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount)
        };
        snake.forEach(part => { if (part.x === coords.x && part.y === coords.y) onSnakeOrFood = true; });
        foods.forEach(f => { if (f.x === coords.x && f.y === coords.y) onSnakeOrFood = true; });
    } while (onSnakeOrFood);
    return coords;
}

function main() {
    if (hasGameEnded()) {
        isGameOver = true;
        stopFoodSpawners();
        SOUNDS.fail();
        setTimeout(() => {
            alert(`Игра окончена! Ваш счёт: ${score}`);
            checkHighScore(score);
        }, 50);
        return;
    }

    clearTimeout(gameTimeoutId);
    gameTimeoutId = setTimeout(function onTick() {
        clearCanvas();
        checkAndSpawnBlueFood();
        drawFoods();
        moveSnake();
        checkSelfIntersection();
        drawSnake();
        main();
    }, gameSpeed);
}

function checkHighScore(currentScore) {
    const minHighScore = highScores[highScores.length - 1].score;

    if (currentScore > minHighScore && currentScore > 0) {
        const name = prompt("Поздравляем! Вы попали в таблицу рекордов. Введите ваше имя:", "Игрок") || "Аноним";
        highScores.push({ name: name, score: currentScore });
        highScores.sort((a, b) => b.score - a.score);
        highScores = highScores.slice(0, 5);
        localStorage.setItem("snakeHighScores", JSON.stringify(highScores));
        updateLeaderboardUI();
    }
}

function updateLeaderboardUI() {
    recordsList.innerHTML = "";
    highScores.forEach(item => {
        const li = document.createElement("li");
        li.innerText = `${item.name} — ${item.score}`;
        recordsList.appendChild(li);
    });
}

function clearCanvas() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawSnake() {
    ctx.fillStyle = "#4CAF50";
    snake.forEach(part => {
        ctx.fillRect(part.x * gridSize, part.y * gridSize, gridSize - 2, gridSize - 2);
    });
}

// Изменено: теперь функция проверяет, есть ли у еды иконка, и рисует картинку вместо квадрата
function drawFoods() {
    foods.forEach(food => {
        if (food.config.image && food.config.image.complete) {
            // Если картинка загружена, рисуем SVG-иконку банана на игровом поле
            ctx.drawImage(
                food.config.image, 
                food.x * gridSize, 
                food.y * gridSize, 
                gridSize - 2, 
                gridSize - 2
            );
        } else {
            // Для остальных типов еды рисуем привычные цветные квадраты
            ctx.fillStyle = food.config.color;
            ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);
        }
    });
}

function moveSnake() {
    if ((dx === 0 && dy === 0) || isGameOver) return;

    let headX = snake[0].x + dx;
    let headY = snake[0].y + dy;

    if (headX < 0 || headX >= tileCount || headY < 0 || headY >= tileCount) {
        if (wallMode === 'portal') {
            if (headX < 0) headX = tileCount - 1;
            else if (headX >= tileCount) headX = 0;
            else if (headY < 0) headY = tileCount - 1;
            else if (headY >= tileCount) headY = 0;
        } else if (wallMode === 'random') {
            const side = Math.floor(Math.random() * 4);
            const randomPos = Math.floor(Math.random() * tileCount);
            if (side === 0) { headX = randomPos; headY = 0; dx = 0; dy = 1; }
            else if (side === 1) { headX = tileCount - 1; headY = randomPos; dx = -1; dy = 0; }
            else if (side === 2) { headX = randomPos; headY = tileCount - 1; dx = 0; dy = -1; }
            else if (side === 3) { headX = 0; headY = randomPos; dx = 1; dy = 0; }
        }
    }

    const head = { x: headX, y: headY };
    snake.unshift(head);

    let eatenFoodIndex = foods.findIndex(f => f.x === head.x && f.y === head.y);

    if (eatenFoodIndex !== -1) {
        const eatenFood = foods[eatenFoodIndex];
        score += eatenFood.config.score;
        if (score < 0) score = 0;
        scoreElement.innerText = "Счёт: " + score;

        if (SOUNDS[eatenFood.config.type]) SOUNDS[eatenFood.config.type]();

        let growth = eatenFood.config.growth;
        if (growth > 0) {
            snake.growthQueue = (snake.growthQueue || 0) + (growth - 1);
        } else {
            let shrinkAmount = Math.abs(growth);
            for (let i = 0; i < shrinkAmount; i++) {
                if (snake.length > 1) snake.pop();
            }
            if (snake.length > 1) snake.pop();
        }
        foods.splice(eatenFoodIndex, 1);
    } else {
        if (snake.growthQueue && snake.growthQueue > 0) {
            snake.growthQueue--;
        } else {
            if (snake.length > 0) snake.pop();
        }
    }
}

// Изменено: в классическом режиме врезание в хвост теперь завершает игру
function checkSelfIntersection() {
    if (snake.length <= 1 || (dx === 0 && dy === 0)) return;

    const head = snake[0];

    for (let i = 1; i < snake.length; i++) {
        if (snake[i].x === head.x && snake[i].y === head.y) {
            if (wallMode === 'classic') {
                // Если режим классический — принудительно обнуляем змейку, провоцируя проигрыш
                snake = [];
            } else {
                // В остальных режимах — по-прежнему укорачиваем хвост
                snake = snake.slice(0, i);
                score = Math.max(0, score - 15);
                scoreElement.innerText = "Счёт: " + score;
                SOUNDS.cut();
            }
            break;
        }
    }
}

function hasGameEnded() {
    if (snake.length === 0) return true;

    if (wallMode === 'classic') {
        const head = snake[0];
        const hitLeftWall = head.x < 0;
        const hitRightWall = head.x >= tileCount;
        const hitBottomWall = head.y >= tileCount;
        const hitUpperWall = head.y < 0;
        if (hitLeftWall || hitRightWall || hitBottomWall || hitUpperWall) return true;
    }
    return false;
}

function resetGame() {
    clearTimeout(gameTimeoutId);
    stopFoodSpawners();
    snake = [{ x: 10, y: 10 }];
    snake.growthQueue = 0;
    foods = [];
    dx = 0;
    dy = 0;
    score = 0;
    scoreElement.innerText = "Счёт: " + score;
    isGameOver = false;
    main();
}

// Логика поворота, вынесенная отдельно для клавиатуры и тача
function handleDirectionChange(targetDx, targetDy) {
    if (dx === 0 && dy === 0) {
        initAudio();
        startFoodSpawners();
    }
    dx = targetDx;
    dy = targetDy;
}

function changeDirection(event) {
    if (isGameOver) return;
    const keyPressed = event.keyCode;
    const LEFT_KEY = 37; const UP_KEY = 38; const RIGHT_KEY = 39; const DOWN_KEY = 40;

    if (keyPressed === LEFT_KEY && dx !== 1) handleDirectionChange(-1, 0);
    if (keyPressed === UP_KEY && dy !== 1) handleDirectionChange(0, -1);
    if (keyPressed === RIGHT_KEY && dx !== -1) handleDirectionChange(1, 0);
    if (keyPressed === DOWN_KEY && dy !== -1) handleDirectionChange(0, 1);
}

document.addEventListener("keydown", changeDirection);

// Слушатели для экранного джойстика смартфона
document.getElementById("btnUp").addEventListener("touchstart", (e) => { e.preventDefault(); if (dy !== 1) handleDirectionChange(0, -1); });
document.getElementById("btnDown").addEventListener("touchstart", (e) => { e.preventDefault(); if (dy !== -1) handleDirectionChange(0, 1); });
document.getElementById("btnLeft").addEventListener("touchstart", (e) => { e.preventDefault(); if (dx !== 1) handleDirectionChange(-1, 0); });
document.getElementById("btnRight").addEventListener("touchstart", (e) => { e.preventDefault(); if (dx !== -1) handleDirectionChange(1, 0); });

const clearBtn = document.createElement("button");
clearBtn.innerText = "Сбросить таблицу";
clearBtn.style.cssText = "width:100%; margin-top:15px; background:#555; color:white; border:none; padding:5px; cursor:pointer; border-radius:4px;";
clearBtn.onclick = () => {
    if(confirm("Вы уверены, что хотите удалить все рекорды?")) {
        localStorage.removeItem("snakeHighScores");
        location.reload();
    }
};
document.querySelector(".leaderboard").appendChild(clearBtn);

main();
