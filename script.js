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
    const DRAG_THRESHOLD = 4;

    function detectDropTargetIsWindow(e, dI) {
        dI.style.pointerEvents = 'none';
        const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
        dI.style.pointerEvents = '';
        return !!elementBelow?.closest('.window');
    }

    desktopItems.forEach(dI => {
        let startPos = { x: 0, y: 0 };
        let isOverWindow = false;
        let initialTarget = null;
        let initialActiveElement = null;

        dI.addEventListener('dblclick', e => {
            if (e.target.closest('.desktop-item-label-editor')) return;
            appManager.open(dI.dataset.app);
        });

        makeDraggable(dI, dI, {
            threshold: DRAG_THRESHOLD,
            ignoreSelectors: '.desktop-item-label-editor',
            onStart: e => {
                const rect = dI.getBoundingClientRect();
                startPos = { x: rect.left, y: rect.top };
                initialTarget = e.target;
                initialActiveElement = document.activeElement;
                dI.style.zIndex = windows.length + 1;
            },
            onMove: (e, interaction, x, y) => {
                moveElement(dI, x, y, interaction);
                isOverWindow = detectDropTargetIsWindow(e, dI);
                dI.style.cursor = isOverWindow ? 'no-drop' : '';
            },
            onEnd: (e, interaction) => {
                dI.style.zIndex = '';
                dI.style.cursor = '';

                if (interaction.moved) {
                    if (isOverWindow) {
                        dI.style.left = startPos.x + 'px';
                        dI.style.top = startPos.y + 'px';
                    }
                } else {
                    handleRenameLabel(dI, initialTarget, initialActiveElement);
                }
            }
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
    windows.forEach(win => {
        const titleBar = win.querySelector('.title-bar');

        win.addEventListener('pointerdown', () => {
            windowManager.focus(win);
        });

        titleBar.addEventListener('click', e => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            e.stopPropagation();

            const appId = win.dataset.app;
            const action = btn.dataset.action;
            if (action === 'close') appManager.close(appId);
            else if (action === 'minimize') appManager.minimize(appId);
        });

        makeDraggable(titleBar, win, {
            ignoreSelectors: 'button[data-action]',
            onStart: () => {
                const rect = win.getBoundingClientRect();
                win.style.transform = 'none';
                win.style.left = rect.left + 'px';
                win.style.top = rect.top + 'px';
            },
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
        const newWindowFocus = this.stack.findLast(w =>
            !w.classList.contains('close') && !w.classList.contains('minimized')
        );
        this.focus(newWindowFocus);
    },
};

windowManager.init(windows);

// drag-and-drop-logic

function makeDraggable(dragTarget, moveTarget, options = {}) {
    let interaction = {
        pointerId: null,
        active: false,
        moved: false,
        startX: 0,
        startY: 0,
        offsetX: 0,
        offsetY: 0,
        dimensions: { x: 0, y: 0 },
    };

    const threshold = options.threshold || 0;

    dragTarget.addEventListener('pointerdown', e => {
        if (options.ignoreSelectors && e.target.closest(options.ignoreSelectors)) return;

        interaction.pointerId = e.pointerId;
        interaction.active = false;
        interaction.moved = false;
        interaction.startX = e.clientX;
        interaction.startY = e.clientY;

        const rect = moveTarget.getBoundingClientRect();
        interaction.dimensions = { x: rect.width, y: rect.height };
        interaction.offsetX = e.clientX - rect.left;
        interaction.offsetY = e.clientY - rect.top;

        dragTarget.setPointerCapture(e.pointerId);

        if (options.onStart) options.onStart(e, interaction);
    });

    dragTarget.addEventListener('pointermove', e => {
        if (interaction.pointerId !== e.pointerId) return;

        const dx = e.clientX - interaction.startX;
        const dy = e.clientY - interaction.startY;
        const distance = Math.hypot(dx, dy);

        if (!interaction.active && distance >= threshold) {
            interaction.active = true;
            interaction.moved = true;
        }

        if (!interaction.active) return;

        const x = e.clientX - interaction.offsetX;
        const y = e.clientY - interaction.offsetY;

        if (options.onMove) {
            options.onMove(e, interaction, x, y);
        } else {
            moveElement(moveTarget, x, y, interaction);
        }
    });

    dragTarget.addEventListener('pointerup', e => {
        if (interaction.pointerId !== e.pointerId) return;

        interaction.active = false;
        dragTarget.releasePointerCapture(e.pointerId);

        if (options.onEnd) options.onEnd(e, interaction);
        interaction.pointerId = null;
    });
}

// application-logic

const appManager = {
    states: new Map(),

    init: function () {
        const appIds = [...new Set([...document.querySelectorAll('.window')]
            .map(win => win.dataset.app))];

        appIds.forEach(appId => {
            this.states.set(appId, {
                appId,
                open: false,
                minimized: false,
                active: false,
            });
        });
    },

    getState: function (appId) {
        return this.states.get(appId);
    },

    getWindows: function (appId) {
        return [...document.querySelectorAll(`.window[data-app="${appId}"]`)];
    },

    open: function (appId) {
        const state = this.getState(appId);
        const appWindows = this.getWindows(appId);
        if (!appWindows.length) return;

        const lastFocused = windowManager.stack.findLast(w =>
            w.dataset.app === appId && !w.classList.contains('close'));

        const windowToFocus = lastFocused || appWindows.find(w => w.classList.contains('main-window')) || appWindows[0];

        if (state.minimized) {
            appWindows.forEach(win => win.classList.remove('minimized'));
        } else {
            windowToFocus.classList.remove('minimized', 'close');
        }

        state.open = true;
        state.minimized = false;
        state.active = true;

        windowManager.focus(windowToFocus);
        taskbarManager.setStatus(appId, 'active');
        // focusApplicationGroup(appId);
    },

    minimize: function (appId) {
        const state = this.getState(appId);
        const visibleWindows = this.getWindows(appId).filter(w => !w.classList.contains('close'));

        if (!visibleWindows.length) return;

        state.minimized = true;
        state.active = false;

        visibleWindows.forEach(win => {
            win.classList.add('minimized');
            win.classList.remove('active');
        });

        taskbarManager.setStatus(appId, '');

        const newWindowFocus = windowManager.stack.findLast(w =>
            !w.classList.contains('close') && !w.classList.contains('minimized'));
        if (newWindowFocus) windowManager.focus(newWindowFocus);
    },

    close: function (appId) {
        const state = this.getState(appId);
        const visibleWindows = this.getWindows(appId).filter(w => !w.classList.contains('close'));

        visibleWindows.forEach(win => windowManager.close(win));

        state.open = false;
        state.minimized = false;
        state.active = false;

        taskbarManager.setStatus(appId, 'close');
        appRegistry.trigger(appId, 'onClose');
    }
}

appManager.init();

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

const taskbarManager = {
    items: {},
    init: function () {
        const taskbarItems = document.querySelectorAll('.taskbar-items .taskbar-item');
        taskbarItems.forEach(item => {
            const appId = item.dataset.app;
            this.items[appId] = item;

            item.addEventListener('click', () => {
                const appState = appManager.getState(appId);
                appState.active ? appManager.minimize(appId) : appManager.open(appId);
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
        appManager.close('rps');
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

appManager.open('rps');
