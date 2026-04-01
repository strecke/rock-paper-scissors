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
const windows = content.querySelectorAll('.window');
const desktopItems = content.querySelectorAll('.desktop-item');

function handleDesktopItemInteraction() {

    function createInitialInteractionState() {
        return {
            pointer: {
                id: null,
                startX: 0,
                startY: 0,
            },
            drag: {
                active: false,
                moved: false,
                offsetX: 0,
                offsetY: 0,
                dimensions: { x: 0, y: 0 },
                prevPos: { x: 0, y: 0 },
            },
            drop: {
                isOverWindow: false,
            },
            click: {
                initialTarget: null,
                initialElement: null,
            }
        };
    }

    function updateDragState(e, interaction, threshold) {
        const dx = e.clientX - interaction.pointer.startX;
        const dy = e.clientY - interaction.pointer.startY;
        const distance = Math.hypot(dx, dy);
        if (!interaction.drag.active && distance >= threshold) {
            interaction.drag.active = true;
            interaction.drag.moved = true;
        }
    }

    function detectDropTargetIsWindow(e, dI) {
        dI.style.pointerEvents = 'none';
        const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
        dI.style.pointerEvents = '';
        return !!elementBelow?.closest('.window');
    }

    function startInteraction(e, dI, interaction) {
        interaction.pointer.id = e.pointerId;
        interaction.pointer.startX = e.clientX;
        interaction.pointer.startY = e.clientY;

        const rect = dI.getBoundingClientRect();
        interaction.drag.active = false;
        interaction.drag.moved = false;
        interaction.drag.offsetX = e.clientX - rect.left;
        interaction.drag.offsetY = e.clientY - rect.top;
        interaction.drag.startPos = { x: rect.left, y: rect.top };
        interaction.drag.dimensions = { x: rect.width, y: rect.height };

        interaction.drop.isOverWindow = false;

        interaction.click.initialTarget = e.target;
        interaction.click.initialElement = document.activeElement;

        dI.setPointerCapture(e.pointerId);
        dI.style.zIndex = Number(windows.length + 1);
    }

    function resetInteraction(interaction) {
        interaction.pointer.id = null;
        interaction.drag.active = false;
        interaction.drag.moved = false;
        interaction.drop.isOverWindow = false;
        interaction.click.initialTarget = null;
        interaction.click.initialElement = null;
    }

    const DRAG_THRESHOLD = 4;

    desktopItems.forEach(dI => {
        let interaction = createInitialInteractionState();

        dI.addEventListener('pointerdown', e => {
            if (e.target.closest('.desktop-item-label-editor')) return;
            startInteraction(e, dI, interaction);
        });

        dI.addEventListener('pointermove', e => {
            if (interaction.pointer.id !== e.pointerId) return;

            updateDragState(e, interaction, DRAG_THRESHOLD);

            if (!interaction.drag.active) return;

            const x = e.clientX - interaction.drag.offsetX;
            const y = e.clientY - interaction.drag.offsetY;
            moveElement(dI, x, y, interaction.drag)

            interaction.drop.isOverWindow = detectDropTargetIsWindow(e, dI);
            dI.style.cursor = interaction.drop.isOverWindow ? 'no-drop' : '';
        });

        dI.addEventListener('pointerup', e => {
            if (interaction.pointer.id !== e.pointerId) return;

            dI.releasePointerCapture(e.pointerId);
            dI.style.zIndex = '';
            dI.style.cursor = '';

            if (interaction.drag.active) {
                if (interaction.drop.isOverWindow) {
                    const pos = interaction.drag.startPos;
                    dI.style.left = pos.x + 'px';
                    dI.style.top = pos.y + 'px';
                }
            } else {
                handleRenameLabel(dI, interaction.click.initialTarget, interaction.click.initialElement);
            }
            resetInteraction(interaction);

        });
    });
}

handleDesktopItemInteraction();

function moveElement(element, x, y, drag) {
    const newPos = getPosBoundaryCheck(x, y, drag.dimensions);
    element.style.left = newPos.x + 'px';
    element.style.top = newPos.y + 'px';
}

function handleRenameLabel(dI, target, element) {
    const dILabel = dI.querySelector('.desktop-item-label');
    if (!(target === dILabel && element === dI)) return;

    //dI.classList.add('is-renaming');

    const oldText = dILabel.textContent;
    const editor = document.createElement('textarea');
    editor.className = 'desktop-item-label-editor';
    editor.value = oldText;
    editor.maxLength = 32;

    const newDILabel = document.createElement('span');
    newDILabel.className = 'desktop-item-label';

    let finished = false;

    const finishRename = commit => {
        if (finished) return;
        finished = true;
        newDILabel.textContent = commit && editor.value.length > 0 ? editor.value : oldText;
        editor.replaceWith(newDILabel);
        dI.focus();
        //dI.classList.remove('is-renaming');
    };

    dILabel.replaceWith(editor);
    editor.focus();
    editor.select();
    editor.style.height = editor.scrollHeight + 'px';

    editor.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishRename(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finishRename(false);
        }
    });

    editor.addEventListener('blur', () => {
        finishRename(true);
    });

    editor.addEventListener('pointerdown', e => {
        e.stopPropagation();
    });

    editor.addEventListener('input', e => {
        editor.style.height = 'auto';
        editor.style.height = editor.scrollHeight + 'px';
    });
}

function handleWindowInteraction() {
    windows.forEach(win => {
        win.addEventListener('pointerdown', () => {
            setWindowFocus(win);
        });
        win.addEventListener('pointerenter', e => {
        })
        const titleBar = win.querySelector('.title-bar');
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        let winDimensions = { x: 0, y: 0 };

        titleBar.addEventListener('pointerdown', e => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            titleBar.setPointerCapture(e.pointerId);
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
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            const newPos = getPosBoundaryCheck(x, y, winDimensions);

            win.style.left = newPos.x + 'px';
            win.style.top = newPos.y + 'px';
        });

        titleBar.addEventListener('pointerup', e => {
            isDragging = false;
            titleBar.releasePointerCapture(e.pointerId);
        });
    });
}

handleWindowInteraction();

function getPosBoundaryCheck(x, y, dimensions) {
    const contentRect = content.getBoundingClientRect();
    let newPosLeft = x;
    let newPosTop = y;
    newPosLeft = newPosLeft < 0
        ? 0 : newPosLeft + dimensions.x > contentRect.right
            ? contentRect.right - dimensions.x : newPosLeft;

    newPosTop = newPosTop < 0
        ? 0 : newPosTop + dimensions.y > contentRect.bottom
            ? contentRect.bottom - dimensions.y : newPosTop;
    return { x: newPosLeft, y: newPosTop };
}

let windowStack = [...windows];

function setWindowFocus(win) {
    if (!win) return;
    if (win.classList.contains('active')) return;
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
    win.classList.remove('active');
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
        if (gameState.isLastRound) renderFinalWindow();
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

function renderFinalWindow() {
    const finalWindow = document.querySelector('.window.final-window');
    const tBody = finalWindow.querySelector('.table table tbody');
    const finalResultMessage = finalWindow.querySelector('.final-result');

    const isUserWinner = gameState.userScore > gameState.computerScore;

    finalResultMessage.textContent = `Winner: ${isUserWinner ? 'User' : 'Computer'}`;

    renderHistoryTable(tBody, gameState.roundHistory);

    setWindowFocus(finalWindow);
}
