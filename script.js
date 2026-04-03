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

// desktop-item-logic

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
        const interaction = createInitialInteractionState();

        dI.addEventListener('dblclick', e => {
            if (e.target.closest('.desktop-item-label-editor')) return;
            openApplication(dI.dataset.app);
        });

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

    editor.addEventListener('dblclick', e => {
        e.stopPropagation()
    });

    editor.addEventListener('click', e => {
        e.stopPropagation();
    })
}

// window-logic

function handleWindowInteraction() {
    function createInitialWindowInteraction() {
        return {
            pointerId: null,
            active: false,
            offsetX: 0,
            offsetY: 0,
            dimensions: { x: 0, y: 0 },
        };
    }

    function startInteraction(e, win, interaction) {
        interaction.pointerId = e.pointerId;
        interaction.active = true;
        const rect = win.getBoundingClientRect();
        interaction.dimensions = { x: rect.width, y: rect.height };
        interaction.offsetX = e.clientX - rect.left;
        interaction.offsetY = e.clientY - rect.top;

        win.style.transform = 'none';
        win.style.left = rect.left + 'px';
        win.style.top = rect.top + 'px';
    }

    function resetInteraction(interaction) {
        interaction.pointerId = null;
        interaction.active = false;
    }

    function handleTitleBarButtons(action, win) {
        const appId = win.dataset.app;

        if (action === 'close') {
            closeApplication(appId);
        } else if (action === 'minimize') {
            minimizeApplication(appId);
        }
    }

    windows.forEach(win => {
        const titleBar = win.querySelector('.title-bar');
        const interaction = createInitialWindowInteraction();

        win.addEventListener('pointerdown', () => {
            windowManager.focus(win);
        });

        titleBar.addEventListener('pointerdown', e => {
            const btn = e.target.closest('button[data-action]');
            if (btn) return;

            titleBar.setPointerCapture(e.pointerId);
            startInteraction(e, win, interaction);
        });

        titleBar.addEventListener('click', e => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            e.stopPropagation();
            handleTitleBarButtons(btn.dataset.action, win);
        });

        titleBar.addEventListener('pointermove', e => {
            if (!interaction.active || interaction.pointerId !== e.pointerId) return;

            const x = e.clientX - interaction.offsetX;
            const y = e.clientY - interaction.offsetY;
            moveElement(win, x, y, interaction);
        });

        titleBar.addEventListener('pointerup', e => {
            if (interaction.pointerId !== e.pointerId) return;

            resetInteraction(interaction);
            titleBar.releasePointerCapture(e.pointerId);
        });
    });
}

handleWindowInteraction();

function moveElement(element, x, y, drag) {
    const newPos = getPosBoundaryCheck(x, y, drag.dimensions);
    element.style.left = newPos.x + 'px';
    element.style.top = newPos.y + 'px';
}

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

const windowManager = {
    stack: [],
    init: function (allWindows) {
        this.stack = [...allWindows];
    },
    focus: function (win) {
        if (!win || win.classList.contains('active')) return;

        const appId = win.dataset.app;
        const appState = getApplicationState(appId);
        appState.focusedWindow = win;

        this.stack = this.stack.filter(w => w !== win);
        this.stack.push(win);
        this.stack.forEach((w, i) => {
            w.style.zIndex = i + 1;
            w.classList.remove('active');
        });
        win.classList.add('active');
        win.classList.remove('close');
        win.focus();
    },
    close: function (win) {
        win.classList.add('close');
        win.classList.remove('active');
        const appId = win.dataset.app;
        syncFocusedWindow(appId);
        const newWindowFocus = this.stack.findLast(w =>
            !w.classList.contains('close') && !w.classList.contains('minimized')
        );
        this.focus(newWindowFocus);
    },
};

windowManager.init(windows);

function syncFocusedWindow(appId) {
    const appState = getApplicationState(appId);
    const visible = getVisibleApplicationWindows(appId);
    const mainWindow = getMainApplicationWindow(appId);

    if (visible.includes(appState.focusedWindow)) return;

    appState.focusedWindow = visible.includes(mainWindow)
        ? mainWindow
        : visible.at(-1) ?? null;
}

// application-logic

const applicationStates = new Map();

const appRegistry = {
    hooks: {},
    register: function (appId, appHooks) {
        this.hooks[appId] = appHooks;
    },
    trigger: function (appId, event) {
        if (this.hooks[appId] && typeof this.hooks[appId][event] === 'function') {
            this.hooks[appId][event]();
        }
    },
};

function createApplicationState(appId) {
    return {
        appId,
        open: false, // app closed/not opened
        minimized: false,
        active: false, // app visible
        focusedWindow: getMainApplicationWindow(appId),
    };
}

function getApplicationState(appId) {
    if (!applicationStates.has(appId)) {
        applicationStates.set(appId, createApplicationState(appId));
    }
    return applicationStates.get(appId);
}

function initApplicationStates() {
    const appIds = [...new Set([...windows].map(win => win.dataset.app))];
    appIds.forEach(appId => {
        applicationStates.set(appId, createApplicationState(appId));
    });
}

initApplicationStates();

function getAllApplicationWindows(appId) {
    return [...windows].filter(w => w.dataset.app === appId);
}

function getVisibleApplicationWindows(appId) {
    return getAllApplicationWindows(appId).filter(w => !w.classList.contains('close'));
}

function getMainApplicationWindow(appId) {
    return getAllApplicationWindows(appId).find(w => w.classList.contains('main-window'))
        ?? getAllApplicationWindows(appId)[0];
}

function openApplication(appId) {
    const appState = getApplicationState(appId);
    const appWindows = getAllApplicationWindows(appId);
    const mainWindow = getMainApplicationWindow(appId);

    if (!appWindows.length) return;

    const focusedWindow = appState.focusedWindow && appWindows.includes(appState.focusedWindow)
        ? appState.focusedWindow : mainWindow;

    if (appState.minimized) {
        appWindows.forEach(win => win.classList.remove('minimized'));
    } else {
        focusedWindow.classList.remove('minimized', 'close');
    }

    windowManager.focus(focusedWindow);
    appState.focusedWindow = focusedWindow;
    appState.minimized = false;
    appState.open = true;
    appState.active = true;
    focusApplicationGroup(appId);
}

function minimizeApplication(appId) {
    const appState = getApplicationState(appId);
    const visibleWindows = getVisibleApplicationWindows(appId);

    if (!visibleWindows.length) return;

    appState.minimized = true;
    appState.active = false;

    visibleWindows.forEach(win => {
        win.classList.add('minimized');
        win.classList.remove('active');
    });

    unfocusApplicationGroup(appId);
    const newWindowFocus = windowManager.stack.findLast(w => !w.classList.contains('close') && !w.classList.contains('minimized'));
    windowManager.focus(newWindowFocus);
}

function closeApplication(appId) {
    const appState = getApplicationState(appId);
    const visibleWindows = getVisibleApplicationWindows(appId);
    visibleWindows.forEach(win => windowManager.close(win));

    appState.open = false;
    appState.minimized = false;
    appState.active = false;
    appState.focusedWindow = null;

    closeApplicationGroup(appId);

    // app specific
    appRegistry.trigger(appId, 'onClose');
}

const taskbarManager = {
    items: {},
    init: function () {
        const taskbarItems = document.querySelectorAll('.taskbar-items .taskbar-item');
        taskbarItems.forEach(item => {
            const appId = item.dataset.app;
            this.items[appId] = item;

            item.addEventListener('click', () => {
                const appState = getApplicationState(appId);
                appState.active ? minimizeApplication(appId) : openApplication(appId);
            });
        });
    },
    setStatus: function (appId, status) {
        const item = this.items[appId];
        if (!item) return;
        item.classList.remove('active', 'close');
        if (status) item.classList.add(status);
    }
};

taskbarManager.init();

function closeApplicationGroup(appId) {
    taskbarManager.setStatus(appId, 'close');
}

function focusApplicationGroup(appId) {
    Object.keys(taskbarManager.items).forEach(id => {
        taskbarManager.setStatus(id, id === appId ? 'active' : '');
    });
}

function unfocusApplicationGroup(appId) {
    taskbarManager.setStatus(appId, '');
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
    windowManager.focus(roundWindow);
}

function resetGame() {
    gameState = createInitialGameState();
    renderGameState(gameState);
}

function bindGameEvents() {
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
        windowManager.close(roundWindow);
        if (gameState.isLastRound) renderFinalWindow();
    });

    const finalWindow = document.querySelector('.final-window');
    finalWindow.querySelector('button.new').addEventListener('click', () => {
        resetGame();
        windowManager.close(finalWindow);
        windowManager.focus(gameWindow);
    });

    finalWindow.querySelector('button.exit').addEventListener('click', () => {
        closeApplication('rps');
    })
}

bindGameEvents();

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

    windowManager.focus(finalWindow);
}

appRegistry.register('rps', {
    onClose: () => {
        resetGame();
    }
});

openApplication('rps');
