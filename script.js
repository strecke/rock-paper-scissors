// non-game-logic
const menuButton = document.querySelector('.start-menu-container .start-menu-button');
const menu = document.querySelector('.start-menu-container .start-menu');

menuButton.addEventListener('click', (e) => {
    menu.classList.toggle('open');
});

document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && !menuButton.contains(e.target)) {
        menu.classList.remove('open');
    }
});

function updateClock() {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    document.querySelector('.clock').textContent = timeStr;
}

function initClock() {
    updateClock();
    const currentSeconds = new Date().getSeconds();
    const delay = (60 - currentSeconds) * 1000;
    setTimeout(() => {
        updateClock();
        setInterval(updateClock, 60000);
    }, delay);
}

initClock();

const content = document.querySelector('.content');
const windows = document.querySelectorAll('.window');

function moveWindow() {
    let contentRect = content.getBoundingClientRect();
    windows.forEach(win => {
        const titleBar = win.querySelector('.title-bar');
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        let winDimensions = { x: 0, y: 0 };

        win.addEventListener('pointerdown', () => {
            setWindowFocus(win);
        });

        titleBar.addEventListener('pointerdown', e => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            titleBar.setPointerCapture(e.pointerId);
            contentRect = content.getBoundingClientRect();
            const rect = win.getBoundingClientRect();
            winDimensions = { x: rect.width, y: rect.height };
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            win.style.transform = 'none';
            win.style.left = rect.left + 'px';
            win.style.top = rect.top + 'px';
        });

        titleBar.addEventListener('pointermove', e => {
            if (!isDragging) return;
            let newPosLeft = e.clientX - offsetX;
            let newPosTop = e.clientY - offsetY;

            newPosLeft = newPosLeft < 0
                ? 0 : newPosLeft + winDimensions.x > contentRect.right
                    ? contentRect.right - winDimensions.x : newPosLeft;

            newPosTop = newPosTop < 0
                ? 0 : newPosTop + winDimensions.y > contentRect.bottom
                    ? contentRect.bottom - winDimensions.y : newPosTop;
            if (e.clientY - offsetY < contentRect.x) win.style.top = '0px';
            win.style.left = newPosLeft + 'px';
            win.style.top = newPosTop + 'px';
        });

        titleBar.addEventListener('pointerup', e => {
            isDragging = false;
            titleBar.releasePointerCapture(e.pointerId);
        });
    });
}

moveWindow();

let windowStack = [...windows];

function setWindowFocus(win) {
    if (!win) return;
    windowStack = windowStack.filter(w => w !== win);
    windowStack.push(win);
    windowStack.forEach((w, i) => {
        w.style.zIndex = i + 1;
        w.classList.remove('active');
    });
    win.classList.add('active');
    win.focus();
    win.classList.remove('close');
}

function closeWindow(win) {
    win.classList.add('close');
    const newWindowFocus = windowStack.findLast(w => !w.classList.contains('close'));
    setWindowFocus(newWindowFocus);
}

// game-logic

const WIN_SCORE = 5;

function createInitialGameState() {
    return {
        userScore: 0,
        computerScore: 0,
        roundCounter: 1,
        roundHistory: [],
        rpsButtonsDisabled: false,
        isLastRound: false,
        lastRound: null,
    };
}

let gameState = createInitialGameState();

function handleUserChoice(userChoice) {
    gameState = playRound(gameState, userChoice);

    renderRound(gameState.lastRound);
    renderGameState(gameState);

    const roundWindow = document.querySelector('.round-window');
    setWindowFocus(roundWindow);
}

function resetGame() {
    gameState = createInitialGameState();
    renderGameState(gameState);
}

function bindEvents() {
    const gameWindow = document.querySelector('.game-window');
    const gameContent = gameWindow.querySelector('.game-content');
    const rpsButtons = gameContent.querySelectorAll('section button');
    rpsButtons.forEach(b => {
        b.addEventListener('click', () => {
            handleUserChoice(b.dataset.choice);
        });
    });

    const roundWindow = document.querySelector('.round-window');
    roundWindow.querySelector('button').addEventListener('click', () => {
        closeWindow(roundWindow);
        if (gameState.isLastRound) showFinalWindow();
    });

    const finalWindow = document.querySelector('.final-window');
    finalWindow.querySelector('button.new').addEventListener('click', () => {
        resetGame();
        closeWindow(finalWindow);
        setWindowFocus(gameWindow);
    });

    finalWindow.querySelector('button.exit').addEventListener('click', () => {
        resetGame();
        closeWindow(finalWindow);
        closeWindow(gameWindow);
    })
}

bindEvents();

function getComputerChoice() {
    return ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
}

const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper', };
const NAMES = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors', };

function playRound(state, userChoice) {
    const computerChoice = getComputerChoice();
    const isTie = userChoice === computerChoice;
    const isUserWinner = !isTie && BEATS[userChoice] === computerChoice;
    const nextUserScore = state.userScore + (isUserWinner ? 1 : 0);
    const nextComputerScore = state.computerScore + (isTie || isUserWinner ? 0 : 1);

    const round = {
        round: state.roundCounter,
        userChoice,
        computerChoice,
        userLabel: NAMES[userChoice],
        computerLabel: NAMES[computerChoice],
        isTie,
        isUserWinner,
    };

    const isGameOver = nextUserScore >= WIN_SCORE || nextComputerScore >= WIN_SCORE;

    return {
        ...state,
        userScore: nextUserScore,
        computerScore: nextComputerScore,
        roundCounter: state.roundCounter + 1,
        roundHistory: [...state.roundHistory, round],
        rpsButtonsDisabled: isGameOver,
        isLastRound: isGameOver,
        lastRound: round,
    };
}

function renderRound(round) {
    const roundWindow = document.querySelector('.round-window');
    const roundTitle = roundWindow.querySelector('.title-bar-text');
    const userSelection = roundWindow.querySelector('.user-selection');
    const computerSelection = roundWindow.querySelector('.computer-selection');
    const resultMessage = roundWindow.querySelector('.result-message');


    roundTitle.textContent = `Results Round ${round.round}`;
    userSelection.textContent = `User Chose: ${round.userLabel}`;
    computerSelection.textContent = `Computer Chose: ${round.computerLabel}`;

    if (round.isTie) {
        resultMessage.textContent = `It’s a tie!`;
    } else if (round.isUserWinner) {
        resultMessage.textContent = `You Win! ${round.userLabel} beats ${round.computerLabel}`;
    } else {
        resultMessage.textContent = `You Lose! ${round.computerLabel} beats ${round.userLabel}`;
    }
}

function renderGameState(state) {
    const gameWindow = document.querySelector('.game-window');
    const gameContent = gameWindow.querySelector('.game-content');
    const rpsButtons = gameContent.querySelectorAll('section button');

    const progressIndicator = gameContent.querySelector('.progress-indicator.game-progress .progress-indicator-bar');
    const highestPoints = Math.max(state.userScore, state.computerScore);
    const progressPercent = Math.min(highestPoints / WIN_SCORE * 100, 100);
    progressIndicator.style.width = progressPercent + '%';

    const roundWindow = document.querySelector('.round-window');
    const usersPoints = roundWindow.querySelector('.users-points');
    const computersPoints = roundWindow.querySelector('.computers-points');

    usersPoints.textContent = `User: ${state.userScore}`;
    computersPoints.textContent = `Computer: ${state.computerScore}`;

    rpsButtons.forEach((b) => {
        b.disabled = state.rpsButtonsDisabled;
    });
    // renderHistoryTable(state.roundHistory);
}

function renderHistoryTable(tBody, roundHistory) {
    tBody.replaceChildren();

    for (const round of roundHistory) {
        const tr = document.createElement('tr');
        if (round.isUserWinner) tr.classList.add('highlighted');

        const roundTh = document.createElement('th');
        const userTh = document.createElement('th');
        const computerTh = document.createElement('th');

        roundTh.textContent = round.round;
        userTh.textContent = round.userLabel;
        computerTh.textContent = round.computerLabel;

        tr.append(roundTh, userTh, computerTh);
        tBody.append(tr);
    }
}

function showFinalWindow() {
    const finalWindow = document.querySelector('.window.final-window');
    const tBody = finalWindow.querySelector('.table table tbody');
    const finalResultMessage = finalWindow.querySelector('.final-result');

    const isUserWinner = gameState.userScore > gameState.computerScore;
    
    finalResultMessage.textContent = `Winner: ${isUserWinner ? 'User' : 'Computer'}`;

    renderHistoryTable(tBody, gameState.roundHistory);

    setWindowFocus(finalWindow);
}
