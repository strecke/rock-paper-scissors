// non-game-logic
const startMenuButton = document.querySelector('.start-menu-container .start-menu-button');
const startMenu = document.querySelector('.start-menu-container .start-menu');
const startMenuItems = document.querySelectorAll('.start-menu-item');

startMenuButton.addEventListener('click', (e) => {
    startMenu.classList.toggle('open');
    startMenuButton.classList.toggle('active');
});

document.addEventListener("click", (e) => {
    if (!startMenu.contains(e.target) && !startMenuButton.contains(e.target)) {
        startMenu.classList.remove('open');
        startMenuButton.classList.remove('active');
    }
});

document.body.addEventListener('mousedown', () => {
    document.body.classList.add('using-mouse');
});

document.body.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
        document.body.classList.remove('using-mouse');
    }
});

startMenuItems.forEach(btn => {
    btn.addEventListener('click', () => {
        startMenu.classList.remove('open');
        startMenuButton.classList.remove('active');
    });
    if (btn.textContent === 'About') {
        btn.addEventListener('click', () => {
            appManager.open('about');
        });
    }
    if (btn.textContent.includes('Log Off')) {
        btn.addEventListener('click', () => {
            appManager.open('logoff');
        });
    }
});

document.addEventListener('mousedown', e => {
    if (!e.target.closest('.window') && !e.target.closest('.taskbar-item')) {
        windowManager.stack.forEach(w => w.classList.remove('active'));
        taskbarManager.setActiveApp(null);
    }
});

const clock = {
    update: function () {
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        document.querySelector('.clock').textContent = timeStr;
    },
    init: function () {
        this.update();
        const currentSeconds = new Date().getSeconds();
        const delay = (60 - currentSeconds) * 1000;
        setTimeout(() => {
            this.update();
            setInterval(() => this.update(), 60000);
        }, delay);
    }
}

clock.init();

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
        let lastTap = 0;

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
                    const now = Date.now();
                    const timeSinceLastTap = now - lastTap;
                    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
                        appManager.open(dI.dataset.app);
                        lastTap = 0;
                    } else {
                        lastTap = now;
                        handleRenameLabel(dI, initialTarget, initialActiveElement);
                    }
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

    getFocusedAppId: function () {
        const topWindow = this.stack.findLast(w =>
            !w.classList.contains('close') && !w.classList.contains('minimized') && w.classList.contains('active')
        );
        return topWindow ? topWindow.dataset.app : null;
    },

    focus: function (win) {
        if (!win) return;

        const appId = win.dataset.app;

        taskbarManager.setActiveApp(appId);

        if (win.classList.contains('active')) return;

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

        if (newWindowFocus) this.focus(newWindowFocus);
        else taskbarManager.setActiveApp(null);
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
            this.maximize(appId, appWindows, windowToFocus);
        } else {
            windowToFocus.classList.remove('minimized', 'close');
        }

        state.open = true;
        state.minimized = false;

        taskbarManager.items[appId]?.classList.remove('close');

        windowManager.focus(windowToFocus);
        appRegistry.trigger(appId, 'onOpen');
    },

    DURATION_FACTOR: 1.4,

    maximize: function (appId, appWindows, windowToFocus) {
        const taskbarButton = taskbarManager.items[appId];

        if (taskbarButton) {
            const titleBar = windowToFocus.querySelector('.title-bar');
            windowToFocus.style.visibility = 'hidden';
            windowToFocus.classList.remove('minimized');

            const endRect = titleBar.getBoundingClientRect();
            const startRect = taskbarButton.getBoundingClientRect();

            const distance = Math.hypot(endRect.left - startRect.left, endRect.top - startRect.top);
            const duration = distance / this.DURATION_FACTOR;

            const ghostTitleBar = document.createElement('div');
            ghostTitleBar.className = 'title-bar ghost-title-bar';
            const titleText = windowToFocus.querySelector('.title-bar-text').cloneNode(true);
            ghostTitleBar.appendChild(titleText);

            ghostTitleBar.style.left = `${startRect.left}px`;
            ghostTitleBar.style.top = `${startRect.top}px`;
            ghostTitleBar.style.width = `${startRect.width}px`;
            ghostTitleBar.style.height = `${startRect.height}px`;
            ghostTitleBar.style.transition = `all ${duration}ms linear`;

            taskbarButton.style.pointerEvents = 'none';

            document.body.appendChild(ghostTitleBar);
            ghostTitleBar.offsetHeight;

            ghostTitleBar.style.left = `${endRect.left}px`;
            ghostTitleBar.style.top = `${endRect.top}px`;
            ghostTitleBar.style.width = `${endRect.width}px`;
            ghostTitleBar.style.height = `${endRect.height}px`;

            ghostTitleBar.addEventListener('transitionend', e => {
                if (e.propertyName !== 'left') return;
                taskbarButton.style.pointerEvents = '';
                ghostTitleBar.remove();
                windowToFocus.style.visibility = '';
                appWindows.forEach(win => win.classList.remove('minimized'));
            });
        } else {
            // fallback no taskbar-button
            appWindows.forEach(win => win.classList.remove('minimized'));
        }
    },

    minimize: function (appId) {
        const state = this.getState(appId);
        const visibleWindows = this.getWindows(appId).filter(w => !w.classList.contains('close') && !w.classList.contains('minimized'));
        if (!visibleWindows.length) return;

        const activeWindow = visibleWindows.find(w => w.classList.contains('active')) || visibleWindows[0];
        const taskbarButton = taskbarManager.items[appId];

        const finalizeMinimize = () => {
            state.minimized = true;

            visibleWindows.forEach(win => {
                win.classList.add('minimized');
                win.classList.remove('active');
            });

            const newWindowFocus = windowManager.stack.findLast(w =>
                !w.classList.contains('close') && !w.classList.contains('minimized')
            );
            if (newWindowFocus) windowManager.focus(newWindowFocus);
            else taskbarManager.setActiveApp(null);
        };

        if (activeWindow && taskbarButton) {
            const titleBar = activeWindow.querySelector('.title-bar');
            const startRect = titleBar.getBoundingClientRect();
            const endRect = taskbarButton.getBoundingClientRect();

            const distance = Math.hypot(endRect.left - startRect.left, endRect.top - startRect.top);
            const duration = distance / this.DURATION_FACTOR;

            const ghostTitleBar = document.createElement('div');
            ghostTitleBar.className = 'title-bar ghost-title-bar';
            const titleText = activeWindow.querySelector('.title-bar-text').cloneNode(true);
            ghostTitleBar.appendChild(titleText);

            ghostTitleBar.style.left = `${startRect.left}px`;
            ghostTitleBar.style.top = `${startRect.top}px`;
            ghostTitleBar.style.width = `${startRect.width}px`;
            ghostTitleBar.style.height = `${startRect.height}px`;
            ghostTitleBar.style.transition = `all ${duration}ms linear`;

            taskbarButton.style.pointerEvents = 'none';

            document.body.appendChild(ghostTitleBar);

            ghostTitleBar.offsetHeight;

            ghostTitleBar.style.left = `${endRect.left}px`;
            ghostTitleBar.style.top = `${endRect.top}px`;
            ghostTitleBar.style.width = `${endRect.width}px`;
            ghostTitleBar.style.height = `${endRect.height}px`;

            ghostTitleBar.addEventListener('transitionend', e => {
                if (e.propertyName !== 'left') return;
                taskbarButton.style.pointerEvents = '';
                ghostTitleBar.remove();
                finalizeMinimize();
            });
        } else {
            finalizeMinimize();
        }
    },

    close: function (appId) {
        const state = this.getState(appId);
        const visibleWindows = this.getWindows(appId).filter(w => !w.classList.contains('close'));

        visibleWindows.forEach(win => windowManager.close(win));

        state.open = false;
        state.minimized = false;

        taskbarManager.setStatus(appId, 'close');
        appRegistry.trigger(appId, 'onClose');
    },

    toggle: function (appId) {
        const isFocused = windowManager.getFocusedAppId() === appId;

        if (isFocused) this.minimize(appId);
        else this.open(appId);
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
                appManager.toggle(appId);
            });
        });
    },

    setStatus: function (appId, status) {
        const item = this.items[appId];
        if (!item) return;
        item.classList.remove('active', 'close');
        if (status) item.classList.add(status);
    },

    setActiveApp: function (activeAppId) {
        Object.keys(this.items).forEach(id => {
            const item = this.items[id];
            item.classList.remove('active');
            if (id === activeAppId) item.classList.add('active');
        });
    }
};

taskbarManager.init();

// game-logic

const rpsGame = {
    WIN_SCORE: 5,
    BEATS: { rock: 'scissors', paper: 'rock', scissors: 'paper' },
    NAMES: { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' },
    state: {},

    init: function () {
        this.bindEvents();
        this.reset();
    },
    reset: function () {
        this.state = {
            userScore: 0,
            computerScore: 0,
            roundCounter: 1,
            roundHistory: [],
            isGameOver: false,
            lastRound: null,
        };
        this.renderGameState();
    },

    bindEvents: function () {
        const gameWindow = document.querySelector('.game-window[data-app="rps"]');
        const rpsButtons = gameWindow.querySelectorAll('.game-content section button');

        rpsButtons.forEach(b => {
            b.addEventListener('click', () => this.handleUserChoice(b.dataset.choice));
        });

        const roundWindow = document.querySelector('.round-window[data-app="rps"]');
        roundWindow.querySelector('button').addEventListener('click', () => {
            windowManager.close(roundWindow);
            if (this.state.isGameOver) this.renderFinalWindow();
        });

        const finalWindow = document.querySelector('.final-window[data-app="rps"]');
        finalWindow.querySelector('button.new').addEventListener('click', () => {
            this.reset();
            windowManager.close(finalWindow);
            windowManager.focus(gameWindow);
        });

        finalWindow.querySelector('button.exit').addEventListener('click', () => {
            this.reset();
            appManager.close('rps');
        });
    },

    handleUserChoice: function (userChoice) {
        const gameWindow = document.querySelector('.game-window[data-app="rps"]');
        const rpsButtons = gameWindow.querySelectorAll('.game-content section button');
        const roundWindow = document.querySelector('.round-window[data-app="rps"]');

        const calcState = roundWindow.querySelector('.calculating-state');
        const resultState = roundWindow.querySelector('.result-state');
        const progressBar = roundWindow.querySelector('.step-progress-bar');
        const confirmBtn = roundWindow.querySelector('button');
        const indicatorContainer = roundWindow.querySelector('.progress-indicator');

        const titleBarText = roundWindow.querySelector('.title-bar-text');
        titleBarText.textContent = `Loading Round ${this.state.roundCounter}...`;

        gameWindow.style.cursor = 'wait';
        roundWindow.style.cursor = 'wait';
        rpsButtons.forEach(b => {
            b.disabled = true;
            b.style.cursor = 'wait';
        });

        calcState.classList.remove('hidden');
        resultState.classList.add('hidden');

        progressBar.style.transition = 'none';
        progressBar.style.width = '0%';

        appManager.open('rps');
        windowManager.focus(roundWindow);

        if (window.getComputedStyle(roundWindow).transform !== 'none') {
            const rect = roundWindow.getBoundingClientRect();

            roundWindow.style.left = `${rect.left}px`;
            roundWindow.style.right = `${rect.top}px`;
            roundWindow.style.transform = 'none';
        }

        const maxContainerWidth = indicatorContainer.clientWidth - 1;
        const blockWidth = 18;

        const steps = Math.floor(maxContainerWidth / blockWidth);
        const targetWidthPx = steps * blockWidth;

        const thinkTime = steps * Math.floor(Math.random() * 60) + 60;

        // const pauseTime = 1000 - thinkTime;

        const pauseTime = 300;
        progressBar.offsetHeight;


        progressBar.style.transition = `width ${thinkTime}ms steps(${steps}, end)`;
        progressBar.style.width = `${targetWidthPx}px`;

        setTimeout(() => {
            gameWindow.style.cursor = '';
            roundWindow.style.cursor = '';
            rpsButtons.forEach(b => b.style.cursor = '');

            calcState.classList.add('hidden');
            resultState.classList.remove('hidden');

            const computerChoice = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
            const isTie = userChoice === computerChoice;
            const isUserWinner = !isTie && this.BEATS[userChoice] === computerChoice;

            this.state.userScore += isUserWinner ? 1 : 0;
            this.state.computerScore += (isTie || isUserWinner) ? 0 : 1;
            this.state.isGameOver = this.state.userScore >= this.WIN_SCORE || this.state.computerScore >= this.WIN_SCORE;

            this.state.lastRound = {
                round: this.state.roundCounter++,
                userLabel: this.NAMES[userChoice],
                computerLabel: this.NAMES[computerChoice],
                isTie,
                isUserWinner,
            };

            this.state.roundHistory.push(this.state.lastRound);

            this.renderRound();
            this.renderGameState();

            confirmBtn.focus();
        }, thinkTime + pauseTime);
    },

    WIN_PHRASES: ['Hurray!', 'Awesome!', 'Take that!', 'Finally!', 'Let’s go!'],
    LOSE_PHRASES: ['Not again...', 'Darn it!', 'Ouch...', 'Nevermind...', 'Yikes!'],
    TIE_PHRASES: ['Phew!', 'Close one!', 'Again!', 'Boring...'],

    renderRound: function () {
        const round = this.state.lastRound;
        const roundWindow = document.querySelector('.round-window[data-app="rps"]');
        const confirmBtn = roundWindow.querySelector('button');

        roundWindow.querySelector('.title-bar-text').textContent = `Results Round ${round.round}`;
        roundWindow.querySelector('p.user-selection').textContent = `${round.userLabel}`;
        roundWindow.querySelector('p.computer-selection').textContent = `${round.computerLabel}`;

        const userIcon = roundWindow.querySelector('span.icon.user-selection');
        const computerIcon = roundWindow.querySelector('span.icon.computer-selection');

        [userIcon, computerIcon].forEach(icon => {
            icon.classList.remove('icon-rock', 'icon-paper', 'icon-scissors');
        });

        userIcon.classList.add(`icon-${round.userLabel.toLowerCase()}`);
        computerIcon.classList.add(`icon-${round.computerLabel.toLowerCase()}`);

        const resultMessage = roundWindow.querySelector('.result-message');

        const userFieldset = roundWindow.querySelector('fieldset:nth-child(1)');
        const computerFieldset = roundWindow.querySelector('fieldset:nth-child(2)');

        [userFieldset, computerFieldset].forEach(fieldset => fieldset.classList.remove('winner', 'loser'));

        const userLabel = userFieldset.querySelector('legend');
        userLabel.textContent = authApp.currentUser;

        if (round.isTie) {
            resultMessage.textContent = `It’s a tie!`;
            confirmBtn.textContent = this.TIE_PHRASES[Math.floor(Math.random() * this.TIE_PHRASES.length)];
        } else if (round.isUserWinner) {
            userFieldset.classList.add('winner');
            computerFieldset.classList.add('loser');
            resultMessage.textContent = `You Win! ${round.userLabel} beats ${round.computerLabel}`;
            confirmBtn.textContent = this.WIN_PHRASES[Math.floor(Math.random() * this.WIN_PHRASES.length)];
        } else {
            userFieldset.classList.add('loser');
            computerFieldset.classList.add('winner');
            resultMessage.textContent = `You Lose! ${round.computerLabel} beats ${round.userLabel}`;
            confirmBtn.textContent = this.LOSE_PHRASES[Math.floor(Math.random() * this.LOSE_PHRASES.length)];
        }
    },

    renderGameState: function () {
        const gameWindow = document.querySelector('.game-window[data-app="rps"]');
        const roundWindow = document.querySelector('.round-window[data-app="rps"]');

        const highestPoints = Math.max(this.state.userScore, this.state.computerScore);
        const progressPercent = Math.min((highestPoints / this.WIN_SCORE) * 100, 100);

        gameWindow.querySelector('.progress-indicator-bar').style.width = progressPercent + '%';
        roundWindow.querySelector('.users-points').textContent = `You: ${this.state.userScore}`;
        roundWindow.querySelector('.computers-points').textContent = `Computer: ${this.state.computerScore}`;

        gameWindow.querySelectorAll('.game-content section button').forEach(b => {
            b.disabled = this.state.isGameOver;
        });
    },

    EMOJI_WON: ['happy', 'wink', 'mask', 'confetti'],
    EMOJI_LOST: ['sad', 'nervous', 'melting'],

    renderFinalWindow: function () {
        const finalWindow = document.querySelector('.window.final-window[data-app="rps"]');
        const tBody = finalWindow.querySelector('.table table tbody');
        const tHeadUserName = finalWindow.querySelector('.table table thead .current-user');
        tHeadUserName.textContent = authApp.currentUser;

        finalWindow.querySelector('.final-result').textContent = `Winner: ${this.state.userScore > this.state.computerScore ? authApp.currentUser : 'Computer'}`;

        const finalEmoji = finalWindow.querySelector('.flex-container .icon-emoji');

        const currentState = finalEmoji.dataset.state ?? null;
        let availableStates = this.state.userScore > this.state.computerScore ? this.EMOJI_WON : this.EMOJI_LOST;
        availableStates = availableStates.filter(state => state !== currentState);
        const newState = availableStates[Math.floor(Math.random() * availableStates.length)];

        if (currentState) finalEmoji.classList.remove(`icon-${currentState}`);
        finalEmoji.classList.add(`icon-${newState}`);

        finalEmoji.dataset.state = newState;

        tBody.replaceChildren();
        this.state.roundHistory.forEach(round => {
            const tr = document.createElement('tr');
            if (round.isUserWinner) tr.classList.add('highlighted');
            if (round.isTie) tr.classList.add('dimmed');

            const roundTh = document.createElement('th'); roundTh.textContent = round.round;
            const userTh = document.createElement('th'); userTh.textContent = round.userLabel;
            const computerTh = document.createElement('th'); computerTh.textContent = round.computerLabel;

            tr.append(roundTh, userTh, computerTh);
            tBody.append(tr);
        });

        windowManager.focus(finalWindow);
    },
};

rpsGame.init();

appRegistry.register('rps', {
    onClose: () => {
        rpsGame.reset();
    }
});

appManager.open('rps');

// about-app

const aboutApp = {
    init: function () {
        const aboutWindow = document.querySelector('.about-window');
        const emojiBtn = aboutWindow.querySelector('.about-content button.emoji-button');
        const closeBtn = aboutWindow.querySelector('.about-content button[data-action]');


        if (emojiBtn) {
            const emoji = emojiBtn.querySelector('.icon-emoji');
            const states = ['happy', 'sad', 'wink', 'nervous', 'melting', 'mask', 'confetti'];

            emojiBtn.addEventListener('click', () => {
                const currentState = emoji.dataset.state;
                const availableStates = states.filter(state => state !== currentState);
                const newState = availableStates[Math.floor(Math.random() * availableStates.length)];

                emoji.classList.remove(`icon-${currentState}`);
                emoji.classList.add(`icon-${newState}`);

                emoji.dataset.state = newState;
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                appManager.close('about');
            });
        }
    },
}

aboutApp.init();

// auth-app

const authApp = {
    currentUser: 'User',
    init: function () {
        const logoffWindow = document.querySelector('.logoff-window');
        const loginWindow = document.querySelector('.login-window');
        const usernameInput = loginWindow.querySelector('#username');
        const passwordInput = loginWindow.querySelector('#password');

        usernameInput.addEventListener('input', e => {
            e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
        });

        passwordInput.addEventListener('input', e => {
            const cursorPosition = passwordInput.selectionStart;
            const currentLength = passwordInput.value.length;
            passwordInput.value = '*'.repeat(currentLength);
            passwordInput.setSelectionRange(cursorPosition, cursorPosition);
        });

        appRegistry.register('login', {
            onClose: () => {
                document.body.classList.remove('is-logged-off');
            }
        });

        const btnYes = logoffWindow.querySelector('button[data-choice="yes"]');
        const btnNo = logoffWindow.querySelector('button[data-choice="no"]');

        appRegistry.register('logoff', {
            onOpen: () => {
                btnYes.focus();
            }
        });

        btnNo.addEventListener('click', () => {
            appManager.close('logoff');
        });

        btnYes.addEventListener('click', () => {
            appManager.states.forEach(state => {
                if (state.open) {
                    appManager.close(state.appId);
                }
            });
            this.renderLogin();
        });

        const btnOk = loginWindow.querySelector('button[data-choice="ok"]');
        const btnCancel = loginWindow.querySelector('button[data-choice="cancel"]');

        btnCancel.addEventListener('click', () => {
            this.cancelLogin();
        });

        btnOk.addEventListener('click', () => {
            let newName = usernameInput.value.trim();
            const isValidName = /^[a-zA-Z0-9]+$/.test(newName) && newName.length > 0 && newName.length <= 12;

            if (!isValidName) newName = this.currentUser;
            this.currentUser = newName;
            this.updateStartMenuText();
            this.cancelLogin();
        });

        [usernameInput, passwordInput].forEach(input => {
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') btnOk.click();
            });
        });

        this.updateStartMenuText();
    },

    renderLogin: function () {
        document.body.classList.add('is-logged-off');

        const usernameInput = document.querySelector('.login-window #username');
        const passwordInput = document.querySelector('.login-window #password');
        usernameInput.value = this.currentUser;
        passwordInput.value = '';
        appManager.open('login');
        setTimeout(() => usernameInput.focus(), 50);
    },

    cancelLogin: function () {
        appManager.close('login');
    },

    updateStartMenuText: function () {
        const textSpan = document.querySelector('.start-menu-item .logoff-text');
        if (textSpan) {
            textSpan.textContent = `Log Off ${this.currentUser}...`;
        }
    },
}

authApp.init();
