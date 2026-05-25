const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const recordsList = document.getElementById("recordsList");

// Элементы меню и экранов
const mainMenu = document.getElementById("mainMenu") || document.body; // если mainMenu нет, не упадет
const gameScreen = document.getElementById("gameScreen") || document.querySelector(".main-container");
const recordsOverlay = document.getElementById("recordsOverlay") || document.querySelector(".overlay");

// Кнопки с жесткой привязкой к ID из вашего HTML
const startGameBtn = document.getElementById("startGameBtn") || document.getElementById("menuStartBtn");
const viewRecordsBtn = document.getElementById("viewRecordsBtn") || document.getElementById("menuLeaderboardBtn");
const closeRecordsBtn = document.getElementById("closeRecordsBtn") || document.getElementById("closeLeaderboardBtn");
const clearRecordsBtn = document.getElementById("clearRecordsBtn") || document.getElementById("clearBtn");
const exitToMenuBtn = document.getElementById("exitToMenuBtn") || document.getElementById("toMenuBtn");
const resetBtn = document.getElementById("resetBtn");

// Привязка селекторов (защита от старых и новых названий ID)
const wallSelectMenu = document.getElementById("wallSelectMenu") || document.getElementById("wallSelect");
const speedSelectMenu = document.getElementById("speedSelectMenu") || document.getElementById("speedSelect");

const gridSize = 20;
const tileCount = canvas.width / gridSize;

let snake = [{ x: 10, y: 10 }];
let foods = [];
let dx = 0;
let dy = 0;
let score = 0;
let foodIdCounter = 0;

let highScores = JSON.parse(localStorage.getItem("snakeHighScores")) || [
    { name: "Пусто", score: 0 },
    { name: "Пусто", score: 0 },
    { name: "Пусто", score: 0 },
    { name: "Пусто", score: 0 },
    { name: "Пусто", score: 0 }
];

let gameSpeed = 100;
let selectedStartSpeed = 100; // Переменная для сброса скорости при проигрыше
let wallMode = "classic";
let gameTimeoutId = null;
let intervals = [];
let isGameOver = false;
let isPaused = false; 
let audioCtx = null;

updateLeaderboardUI();

const bananaImage = new Image(); bananaImage.src = 'icon/banana.svg';
const goldImage = new Image(); goldImage.src = 'icon/apple.svg';
const redImage = new Image(); redImage.src = 'icon/amanita.svg';
const whiteImage = new Image(); whiteImage.src = 'icon/seafood.svg'; 

const FOOD_TYPES = {
    BLUE:  { color: "#007BFF", image: bananaImage, score: 10,  growth: 1,  type: 'blue',  lifetime: 5000 },
    GOLD:  { color: "#FFD700", image: goldImage,   score: 50,  growth: 10, type: 'gold',  lifetime: 3000 },
    WHITE: { color: "#FFFFFF", image: whiteImage,  score: 25,  growth: 5,  type: 'white', lifetime: 3000 },
    RED:   { color: "#FF5252", image: redImage,    score: -30, growth: -7, type: 'red',   lifetime: 5000 }
};

// --- ЗАЩИЩЕННАЯ ЛОГИКА НАЖАТИЙ ДЛЯ ПК И СМАРТФОНОВ ---

// Функция запуска игры
function triggerStartGame() {
    if (wallSelectMenu) wallMode = wallSelectMenu.value;
    if (speedSelectMenu) gameSpeed = parseInt(speedSelectMenu.value);
    selectedStartSpeed = gameSpeed; 
    if (mainMenu) mainMenu.classList.add("hidden");
    if (gameScreen) gameScreen.classList.remove("hidden");
    initAudio();
    resetGame();
}

// Привязка к кнопке «Начать игру»
if (startGameBtn) {
    startGameBtn.addEventListener("click", triggerStartGame);
    startGameBtn.addEventListener("touchstart", (e) => { e.preventDefault(); triggerStartGame(); });
}

// Привязка к кнопке «Посмотреть рекорды»
if (viewRecordsBtn && recordsOverlay) {
    viewRecordsBtn.addEventListener("click", () => { recordsOverlay.classList.remove("hidden"); });
    viewRecordsBtn.addEventListener("touchstart", (e) => { e.preventDefault(); recordsOverlay.classList.remove("hidden"); });
}

// Привязка к кнопке «Закрыть рекорды»
if (closeRecordsBtn && recordsOverlay) {
    closeRecordsBtn.addEventListener("click", () => { recordsOverlay.classList.add("hidden"); });
    closeRecordsBtn.addEventListener("touchstart", (e) => { e.preventDefault(); recordsOverlay.classList.add("hidden"); });
}

// Привязка к кнопке «Начать сначала» внутри игры
if (resetBtn) {
    resetBtn.addEventListener("click", () => { initAudio(); resetGame(); });
    resetBtn.addEventListener("touchstart", (e) => { e.preventDefault(); initAudio(); resetGame(); });
}

// Привязка к кнопке «В меню» внутри игры
if (exitToMenuBtn) {
    function triggerExitToMenu() {
        clearTimeout(gameTimeoutId);
        stopFoodSpawners();
        if (gameScreen) gameScreen.classList.add("hidden");
        if (mainMenu) mainMenu.classList.remove("hidden");
    }
    exitToMenuBtn.addEventListener("click", triggerExitToMenu);
    exitToMenuBtn.addEventListener("touchstart", (e) => { e.preventDefault(); triggerExitToMenu(); });
}

// Привязка к кнопке «Сбросить рекорды»
if (clearRecordsBtn) {
    function triggerClearRecords() {
        if(confirm("Вы уверены, что хотите удалить все рекорды?")) {
            localStorage.removeItem("snakeHighScores");
            highScores = [{name:"Пусто",score:0},{name:"Пусто",score:0},{name:"Пусто",score:0},{name:"Пусто",score:0},{name:"Пусто",score:0}];
            updateLeaderboardUI();
        }
    }
    clearRecordsBtn.addEventListener("click", triggerClearRecords);
    clearRecordsBtn.addEventListener("touchstart", (e) => { e.preventDefault(); triggerClearRecords(); });
}

function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }

function playSound(frequency, type, duration, vol) {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch (e) { }
}

const SOUNDS = {
    blue: () => playSound(523.25, 'triangle', 0.15, 0.3),
    white: () => { playSound(587.33, 'triangle', 0.1, 0.3); setTimeout(() => playSound(698.46, 'triangle', 0.1, 0.3), 80); },
    gold: () => { playSound(523.25, 'sine', 0.1, 0.4); setTimeout(() => playSound(659.25, 'sine', 0.1, 0.4), 70); setTimeout(() => playSound(783.99, 'sine', 0.1, 0.4), 140); setTimeout(() => playSound(1046.50, 'sine', 0.2, 0.4), 210); },
    red: () => { playSound(220, 'sawtooth', 0.3, 0.2); setTimeout(() => playSound(146.83, 'sawtooth', 0.2, 0.2), 100); },
    cut: () => { playSound(180, 'square', 0.15, 0.2); setTimeout(() => playSound(110, 'square', 0.15, 0.2), 70); },
    fail: () => { playSound(300, 'sawtooth', 0.2, 0.3); setTimeout(() => playSound(200, 'sawtooth', 0.2, 0.3), 150); setTimeout(() => playSound(130, 'sawtooth', 0.4, 0.4), 300); }
};

function startFoodSpawners() {
    stopFoodSpawners();
    // Фоновые таймеры для циклического спавна еды в процессе игры
    intervals.push(setInterval(() => { if (!isPaused) spawnTimedFood(FOOD_TYPES.GOLD); }, 15000));
    intervals.push(setInterval(() => { if (!isPaused) spawnTimedFood(FOOD_TYPES.WHITE); }, 7500));
    intervals.push(setInterval(() => { if (!isPaused) spawnTimedFood(FOOD_TYPES.RED); }, 3750));
}

function stopFoodSpawners() { intervals.forEach(clearInterval); intervals = []; }

function spawnTimedFood(foodType) {
    if ((dx === 0 && dy === 0) || isGameOver || isPaused) return;
    const exists = foods.some(f => f.config.type === foodType.type);
    if (exists) return;

    const newFood = generateFoodCoords();
    foodIdCounter++;

    newFood.id = foodIdCounter;
    newFood.config = { ...foodType };

    if (foodType.type === 'white') {
        newFood.config.image = whiteImage;
    }

    foods.push(newFood);

    setTimeout(() => {
        if (isPaused) {
            let extend = setInterval(() => {
                if (!isPaused) {
                    clearInterval(extend);
                    handleFoodTimeout(newFood);
                }
            }, 500);
        } else {
            handleFoodTimeout(newFood);
        }
    }, foodType.lifetime);
}

function handleFoodTimeout(foodObj) {
    const index = foods.findIndex(f => f.id === foodObj.id);
    if (index > -1) {
        foods.splice(index, 1);
        if (foodObj.config.type === 'blue' && !isGameOver) {
            spawnTimedFood(FOOD_TYPES.BLUE);
        }
    }
}

function checkAndSpawnBlueFood() {
    if (isGameOver || (dx === 0 && dy === 0)) return;
    const blueFood = foods.find(f => f.config.type === 'blue');
    if (!blueFood) {
        spawnTimedFood(FOOD_TYPES.BLUE);
    }
}

function generateFoodCoords() {
    let coords; let onSnakeOrFood;
    do {
        onSnakeOrFood = false;
        coords = { x: Math.floor(Math.random() * tileCount), y: Math.floor(Math.random() * tileCount) };
        snake.forEach(part => { if (part.x === coords.x && part.y === coords.y) onSnakeOrFood = true; });
        foods.forEach(f => { if (f.x === coords.x && f.y === coords.y) onSnakeOrFood = true; });
    } while (onSnakeOrFood);
    return coords;
}

function main() {
    if (isGameOver) return;

    clearTimeout(gameTimeoutId);
    gameTimeoutId = setTimeout(function onTick() {
        if (!isPaused) {
            if (hasGameEnded()) {
                isGameOver = true; stopFoodSpawners(); SOUNDS.fail();
                setTimeout(() => { alert(`Игра окончена! Ваш счёт: ${score}`); checkHighScore(score); }, 50);
                return;
            }
            clearCanvas();
            checkAndSpawnBlueFood();
            drawFoods();
            moveSnake();
            checkSelfIntersection();
            drawSnake();
        }
        main();
    }, gameSpeed);
}

function checkHighScore(currentScore) {
    const minHighScore = highScores.length > 0 ? highScores[highScores.length - 1].score : 0;
    if (currentScore > minHighScore && currentScore > 0) {
        const name = prompt("Введите ваше имя для таблицы рекордов:", "Игрок") || "Аноним";
        highScores.push({ name: name, score: currentScore });
        highScores.sort((a, b) => b.score - a.score); highScores = highScores.slice(0, 5);
        localStorage.setItem("snakeHighScores", JSON.stringify(highScores));
        updateLeaderboardUI();
    }
}

function updateLeaderboardUI() {
    recordsList.innerHTML = "";
    highScores.forEach(item => { const li = document.createElement("li"); li.innerText = `${item.name} — ${item.score}`; recordsList.appendChild(li); });
}

function clearCanvas() { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
function drawSnake() { ctx.fillStyle = "#4CAF50"; snake.forEach(part => { ctx.fillRect(part.x * gridSize, part.y * gridSize, gridSize - 2, gridSize - 2); }); }

function drawFoods() {
    foods.forEach(food => {
        try {
            if (food.config.image && food.config.image.complete && food.config.image.naturalWidth > 0) {
                ctx.drawImage(food.config.image, food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);
            } else {
                ctx.fillStyle = food.config.color;
                ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);
            }
        } catch (e) {
            ctx.fillStyle = food.config.color;
            ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);
        }
    });
}

function moveSnake() {
    if ((dx === 0 && dy === 0) || isGameOver || isPaused || snake.length === 0) return;

    let headX = snake.at(0).x + dx;
    let headY = snake.at(0).y + dy;

    if (headX < 0 || headX >= tileCount || headY < 0 || headY >= tileCount) {
        if (wallMode === 'portal') {
            if (headX < 0) headX = tileCount - 1; else if (headX >= tileCount) headX = 0;
            else if (headY < 0) headY = tileCount - 1; else if (headY >= tileCount) headY = 0;
        } else if (wallMode === 'random') {
            const side = Math.floor(Math.random() * 4); const randomPos = Math.floor(Math.random() * tileCount);
            if (side === 0) { headX = randomPos; headY = 0; dx = 0; dy = 1; }
            else if (side === 1) { headX = tileCount - 1; headY = randomPos; dx = -1; dy = 0; }
            else if (side === 2) { headX = randomPos; headY = tileCount - 1; dx = 0; dy = -1; }
            else if (side === 3) { headX = 0; headY = randomPos; dx = 1; dy = 0; }
        }
    }

    const head = { x: headX, y: headY }; snake.unshift(head);
    let eatenFoodIndex = foods.findIndex(f => f.x === head.x && f.y === head.y);

    if (eatenFoodIndex !== -1) {
        const eatenFood = foods[eatenFoodIndex];

        // Старый счёт для проверки разгона
        const oldScore = score;

        score += eatenFood.config.score;
        if (score < 0) score = 0;
        scoreElement.innerText = "Счёт: " + score;

        // --- ЛОГИКА АВТОМАТИЧЕСКОГО РАЗГОНА ---
        // Если игрок перешагнул порог в очередные 50 очков (например, было 40, стало 60)
        if (Math.floor(score / 50) > Math.floor(oldScore / 50) && score > oldScore) {
            // Уменьшаем задержку на 5% (увеличиваем скорость)
            gameSpeed = Math.max(35, Math.floor(gameSpeed * 0.95));

            // Слегка подсвечиваем счёт зелёным на мгновение, сигнализируя о разгоне
            scoreElement.style.color = "#FFD700";
            setTimeout(() => { scoreElement.style.color = "#4CAF50"; }, 500);
        }

        if (SOUNDS[eatenFood.config.type]) SOUNDS[eatenFood.config.type]();

        let growth = eatenFood.config.growth;
        if (growth > 0) {
            snake.growthQueue = (snake.growthQueue || 0) + (growth - 1);
        } else {
            let shrinkAmount = Math.abs(growth);
            for (let i = 0; i < shrinkAmount; i++) { if (snake.length > 2) snake.pop(); }
            if (snake.length > 1) snake.pop();
        }
        foods.splice(eatenFoodIndex, 1);

        if (eatenFood.config.type === 'blue' && !isGameOver) {
            spawnTimedFood(FOOD_TYPES.BLUE);
        }
    } else {
        if (snake.growthQueue && snake.growthQueue > 0) { snake.growthQueue--; } else { if (snake.length > 1) snake.pop(); }
    }
}

function checkSelfIntersection() {
    if (snake.length <= 1 || (dx === 0 && dy === 0) || isPaused) return;
    const head = snake.at(0);
    for (let i = 1; i < snake.length; i++) {
        if (snake[i].x === head.x && snake[i].y === head.y) {
            if (wallMode === 'classic') {
                snake = [];
            } else {
                snake = snake.slice(0, Math.max(1, i));
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
        const head = snake.at(0);
        const hitLeftWall = head.x < 0; const hitRightWall = head.x >= tileCount; const hitBottomWall = head.y >= tileCount; const hitUpperWall = head.y < 0;
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
    
    // ВОЗВРАТ СКОРОСТИ: Сбрасываем разогнанную скорость до сохранённой из меню
    gameSpeed = selectedStartSpeed; 
    
    isGameOver = false; 
    foodIdCounter = 0;
    main(); 
}

// ИСПРАВЛЕНО НА 100%: Порядок строк изменен. Сначала задаются dx и dy, 
// и только ПОСЛЕ этого запускаются спавнеры. Банан и Яблоко создаются мгновенно на старте!
function handleDirectionChange(targetDx, targetDy) {
    if (isPaused || isGameOver) return;
    if (dx === 0 && dy === 0) {
        initAudio();
        dx = targetDx; dy = targetDy; // Сначала даем толчок змейке
        startFoodSpawners();
        spawnTimedFood(FOOD_TYPES.BLUE); // Мгновенно выкидываем первый банан
        return;
    }
    dx = targetDx; dy = targetDy;
}

function changeDirection(event) {
    if (isGameOver || isPaused) return;
    const keyPressed = event.keyCode;
    if (keyPressed === 37 && dx !== 1) handleDirectionChange(-1, 0);
    if (keyPressed === 38 && dy !== 1) handleDirectionChange(0, -1);
    if (keyPressed === 39 && dx !== -1) handleDirectionChange(1, 0);
    if (keyPressed === 40 && dy !== -1) handleDirectionChange(0, 1);
}

document.addEventListener("keydown", changeDirection);

document.getElementById("btnUp").addEventListener("touchstart", (e) => { e.preventDefault(); if (dy !== 1) handleDirectionChange(0, -1); });
document.getElementById("btnDown").addEventListener("touchstart", (e) => { e.preventDefault(); if (dy !== -1) handleDirectionChange(0, 1); });
document.getElementById("btnLeft").addEventListener("touchstart", (e) => { e.preventDefault(); if (dx !== 1) handleDirectionChange(-1, 0); });
document.getElementById("btnRight").addEventListener("touchstart", (e) => { e.preventDefault(); if (dx !== -1) handleDirectionChange(1, 0); });
