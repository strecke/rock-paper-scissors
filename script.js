// non-game-logic
const CONFIG = {
    startMenuHoverDelay: 250,
    dragSoundPreventionMs: 50,
    doubleClickThreshold: 300,
    pauseTimeAfterProgress: 300,
};

const startMenuManager = {
    startMenuContainer: document.querySelector('.start-menu-container'),
    startMenuButton: document.querySelector('.start-menu-container .start-menu-button'),
    startMenu: document.querySelector('.start-menu-container .start-menu'),
    topLevelItems: document.querySelectorAll('.start-menu > .start-items > li'),
    folderTimeout: null,
    isProgrammaticBlur: false,
    submenus: document.querySelectorAll('.has-submenu'),

    init: function () {
        document.addEventListener('keydown', e => {
            if (e.key === 'Tab') this.isKeyboardNav = true;
        });

        document.addEventListener('pointerdown', () => {
            this.isKeyboardNav = false;
        });

        this.startMenuButton.addEventListener('click', e => {
            this.toggleStartMenu();
        });

        document.addEventListener('pointerdown', e => {
            if (!this.startMenu.contains(e.target) && !this.startMenuButton.contains(e.target)) {
                if (this.startMenu.classList.contains('open')) this.toggleStartMenu(true);
            }
        });

        this.startMenu.addEventListener('click', e => {
            const targetBtn = e.target.closest('a, button');
            if (!targetBtn) return;
            if (targetBtn.nextElementSibling
                && targetBtn.nextElementSibling.classList.contains('submenu')) {
                return;
            }
            this.toggleStartMenu(true);
            if (targetBtn.dataset.app) appManager.open(targetBtn.dataset.app);
        });

        this.startMenu.addEventListener('pointerover', e => {
            const hoveredItem = e.target.closest('a, button');
            if (!hoveredItem) return;
            const activeEl = document.activeElement;
            if (activeEl && this.startMenu.contains(activeEl) && activeEl !== hoveredItem) {
                this.isProgrammaticBlur = true;
                activeEl.blur();
                this.isProgrammaticBlur = false;
            }
        });

        this.startMenu.addEventListener('transitionend', e => {
            if (e.propertyName === 'max-height' && this.startMenu.classList.contains('open')) {
                this.startMenu.style.overflow = 'visible';
            }
        });

        this.topLevelItems.forEach(li => {
            li.addEventListener('pointerenter', () => {
                clearTimeout(this.folderTimeout);

                this.folderTimeout = setTimeout(() => {
                    this.topLevelItems.forEach(item => {
                        if (item !== li) item.classList.remove('open');
                    });

                    if (li.classList.contains('has-submenu')) {
                        li.classList.add('open');
                    }
                }, CONFIG.startMenuHoverDelay);
            });

            li.addEventListener('pointerleave', () => {
                clearTimeout(this.folderTimeout);
            });

            li.addEventListener('focusin', () => {
                clearTimeout(this.folderTimeout);

                this.topLevelItems.forEach(item => {
                    if (item !== li) item.classList.remove('open');
                });
            });
        });

        this.startMenu.addEventListener('focusin', () => {
            if (!this.startMenu.classList.contains('open')) {
                this.toggleStartMenu();
            }
        });

        this.startMenuContainer.addEventListener('focusout', e => {
            if (this.isProgrammaticBlur) return;
            if (!this.startMenuContainer.contains(e.relatedTarget)) {
                this.toggleStartMenu(true);
            }
        });

        this.startMenu.addEventListener('scroll', () => {
            this.startMenu.scrollTop = 0;
        });
    },

    toggleStartMenu: function (forceClose) {
        this.startMenu.style.overflow = 'hidden';
        if (forceClose || this.startMenu.classList.contains('open')) {
            this.startMenu.classList.remove('open');
            this.startMenuButton.classList.remove('active');
            this.submenus.forEach(item => item.classList.remove('open'));
        } else {
            this.startMenu.classList.add('open');
            this.startMenuButton.classList.add('active');
            windowManager.stack.forEach(w => w.classList.remove('active'));
            taskbarManager.setActiveApp(null);
        }
    },
};

startMenuManager.init();

document.addEventListener('mousemove', () => {
    document.body.classList.add('using-mouse');
}, { passive: true });

document.addEventListener('touchstart', () => {
    document.body.classList.remove('using-mouse');
}, { passive: true });

document.body.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
        document.body.classList.remove('using-mouse');
    }
});

document.addEventListener('mousedown', e => {
    if (!e.target.closest('.window') && !e.target.closest('.taskbar-item')) {
        windowManager.stack.forEach(w => w.classList.remove('active'));
        taskbarManager.setActiveApp(null);
    }
});

const clock = {
    timeoutId: null,
    intervalId: null,

    update: function () {
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        document.querySelector('.clock').textContent = timeStr;
    },

    init: function () {
        this.update();
        const currentSeconds = new Date().getSeconds();
        const delay = (60 - currentSeconds) * 1000;
        this.timeoutId = setTimeout(() => {
            this.update();
            this.intervalId = setInterval(() => this.update(), 60000);
        }, delay);
    },

    stop: function () {
        if (this.timeoutId) clearTimeout(this.timeoutId);
        if (this.intervalId) clearInterval(this.intervalId);
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
            },
            onMove: (e, interaction, x, y) => {
                if (!interaction.ghost) {
                    interaction.ghost = dI.cloneNode(true);
                    interaction.ghost.classList.add('desktop-item-ghost', 'dimmed');
                    interaction.ghost.style.zIndex = windows.length + 1;
                    document.body.appendChild(interaction.ghost);
                }
                moveElement(interaction.ghost, x, y, interaction);
                isOverWindow = detectDropTargetIsWindow(e, dI);
                dI.style.cursor = isOverWindow ? 'no-drop' : '';
            },
            onEnd: (e, interaction) => {
                dI.style.zIndex = '';
                dI.style.cursor = '';

                if (interaction.moved) {
                    if (interaction.ghost) {
                        if (!isOverWindow) {
                            dI.style.left = interaction.ghost.style.left;
                            dI.style.top = interaction.ghost.style.top;
                        }
                        // else {
                        //     dI.style.left = startPos.x + 'px';
                        //     dI.style.top = startPos.y + 'px';
                        // }
                        interaction.ghost.remove();
                        interaction.ghost = undefined;
                    }
                } else {
                    const now = Date.now();
                    const timeSinceLastTap = now - lastTap;
                    if (timeSinceLastTap < CONFIG.doubleClickThreshold && timeSinceLastTap > 0) {
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
            audioManager.play('click', 0.5);

            const appId = win.dataset.app;
            const action = btn.dataset.action;
            if (action === 'close') appManager.close(appId);
            else if (action === 'minimize') appManager.minimize(appId);
        });

        makeDraggable(titleBar, win, {
            ignoreSelectors: 'button',
            onStart: () => {
                const rect = win.getBoundingClientRect();
                win.style.transform = 'none';
                win.style.left = rect.left + 'px';
                win.style.top = rect.top + 'px';
            },
            onMove: (e, interaction, x, y) => {
                if (!interaction.ghost) {
                    interaction.ghost = document.createElement('div');
                    interaction.ghost.className = 'window-drag-ghost';
                    interaction.ghost.style.zIndex = windows.length + 1;


                    interaction.ghost.style.width = interaction.dimensions.x + 'px';
                    interaction.ghost.style.height = interaction.dimensions.y + 'px';
                    document.body.appendChild(interaction.ghost);
                }
                moveElement(interaction.ghost, x, y, interaction);
            },
            onEnd: (e, interaction) => {
                if (interaction.ghost) {
                    win.style.left = interaction.ghost.style.left;
                    win.style.top = interaction.ghost.style.top;
                    interaction.ghost.remove();
                    interaction.ghost = undefined;
                }
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

function enforceBoundariesOnResize() {
    const movableElements = document.querySelectorAll('.window[style*="left"], .desktop-item[style*="left"');

    movableElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        let currentLeft = parseFloat(el.style.left);
        let currentTop = parseFloat(el.style.top);

        moveElement(el, currentLeft, currentTop, { dimensions: { x: rect.width, y: rect.height } });
    });
}

window.addEventListener('resize', enforceBoundariesOnResize);

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

    const handleDragEnd = e => {
        if (interaction.pointerId !== e.pointerId) return;
        if (interaction.moved) {
            dragTarget.setAttribute('data-just-dragged', 'true');
            setTimeout(() => dragTarget.removeAttribute('data-just-dragged'), CONFIG.dragSoundPreventionMs);
        }
        interaction.active = false;
        dragTarget.releasePointerCapture(e.pointerId);
        interaction.pointerId = null;

        if (options.onEnd) options.onEnd(e, interaction);
    };

    dragTarget.addEventListener('pointerup', handleDragEnd);
    //dragTarget.addEventListener('pointercancel', handleDragEnd);
    dragTarget.addEventListener('lostpointercapture', handleDragEnd);
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

            ghostTitleBar.style.zIndex = windows.length + 1;

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

            ghostTitleBar.style.zIndex = windows.length + 1;

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
    globalHistory: [],
    isLocalStorageEnabled: null,

    init: function () {
        this.initStorage();
        this.bindEvents();
        this.reset();
    },

    renderEmptyHistory: function (tBody) {
        tBody.replaceChildren();
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.colSpan = 4;
        th.style.textAlign = 'center';
        th.classList.add('dimmed');
        th.textContent = 'No games played yet.';
        tr.append(th); tBody.append(tr);
    },

    initStorage: function () {
        const saved = localStorage.getItem('rps_history');
        if (saved) {
            this.globalHistory = JSON.parse(saved);
            this.isLocalStorageEnabled = true;
        } else {
            this.isLocalStorageEnabled = null;
        }
    },

    persistToStorage: function () {
        if (this.isLocalStorageEnabled) {
            localStorage.setItem('rps_history', JSON.stringify(this.globalHistory));
        }
    },

    saveToHistory: function () {
        const isUserWinner = this.state.userScore > this.state.computerScore;
        const gameRecord = {
            id: Date.now(),
            userName: authApp.currentUser,
            userScore: this.state.userScore,
            computerScore: this.state.computerScore,
            ties: this.state.ties,
            totalRounds: this.state.roundCounter,
            isUserWinner: isUserWinner,
            winner: isUserWinner ? authApp.currentUser : 'Computer',
            date: '',
            score: `${this.state.userScore} : ${this.state.computerScore}`,
        };

        gameRecord.date = new Date(gameRecord.id).toLocaleDateString();

        this.globalHistory.push(gameRecord);

        if (this.isLocalStorageEnabled) this.persistToStorage();
    },

    reset: function () {
        this.state = {
            userScore: 0,
            computerScore: 0,
            ties: 0,
            roundCounter: 1,
            roundHistory: [],
            isGameOver: false,
            lastRound: null,
            get winrate() {
                return Math.round((this.userScore / this.roundCounter) * 1000) / 10;
            },
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
        roundWindow.querySelector('button').addEventListener('click', e => {
            windowManager.close(roundWindow);
            if (this.state.isGameOver) {
                this.saveToHistory();
                if (this.isLocalStorageEnabled === null) {
                    e.stopPropagation();
                    const localStorageDialog = {
                        title: 'Local Storage Warning',
                        message: 'Do you want to save your game history on your local machine?',
                        onClick: function (e) {
                            e.stopPropagation();
                            handleDialogClose(e.target.dataset.choice === 'yes');
                        },
                        dataChoices: ['yes', 'no'],
                        dataApp: 'rps',
                    }
                    systemManager.showDialog(localStorageDialog);
                } else {
                    this.renderFinalWindow();
                }
            };
        });

        const handleDialogClose = isYes => {
            this.isLocalStorageEnabled = isYes;
            if (isYes) this.persistToStorage();
            this.renderFinalWindow();
        };

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

        const historyWindow = document.querySelector('.window.history-window[data-app="rps"]');
        finalWindow.querySelector('button.history').addEventListener('click', () => {
            windowManager.focus(historyWindow);
            historyWindow.querySelector('.history-content section .close-history').focus();
        });

        historyWindow.querySelectorAll('button.close-history').forEach(b => {
            b.addEventListener('click', () => windowManager.close(historyWindow));
        });

        historyWindow.querySelector('button.clear-history').addEventListener('click', () => {
            this.globalHistory = [];
            localStorage.removeItem('rps_history');
            this.isLocalStorageEnabled = null;
            const tBody = historyWindow.querySelector('tbody');
            this.renderEmptyHistory(tBody);
        });

        document.addEventListener('keydown', e => {
            if (!gameWindow.classList.contains('active')) return;
            const keyMap = {
                '1': 'rock',
                '2': 'paper',
                '3': 'scissors',
            };

            const choice = keyMap[e.key];
            if (!choice) return;

            const btn = gameWindow.querySelector(`button[data-choice="${choice}"]`);
            if (btn && !btn.disabled) {
                btn.focus();
                btn.click();
            }
        });
    },

    renderHistoryWindow: function () {
        const historyWindow = document.querySelector('.window.history-window[data-app="rps"]');
        const tBody = historyWindow.querySelector('tbody');

        if (!this.globalHistory.length) {
            this.renderEmptyHistory(tBody);
            return;
        }

        tBody.replaceChildren();

        this.globalHistory.slice().reverse().forEach(game => {
            const tr = document.createElement('tr');

            if (game.winner === authApp.currentUser && game.isUserWinner) tr.classList.add('highlighted');
            if (!game.isUserWinner) tr.classList.add('dimmed');

            const dateTh = document.createElement('th'); dateTh.textContent = game.date;
            const winnerTh = document.createElement('th'); winnerTh.textContent = game.winner;
            const scoreTh = document.createElement('th'); scoreTh.textContent = game.score;
            const roundsTh = document.createElement('th'); roundsTh.textContent = game.totalRounds;

            tr.append(dateTh, winnerTh, scoreTh, roundsTh);
            tBody.appendChild(tr);
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

        progressBar.offsetHeight;


        progressBar.style.transition = `width ${thinkTime}ms steps(${steps}, end)`;
        progressBar.style.width = `${targetWidthPx}px`;

        let isRoundProcessed = false;
        const finalizeRound = () => {
            if (isRoundProcessed) return;
            isRoundProcessed = true;
            setTimeout(() => {
                gameWindow.style.cursor = '';
                roundWindow.style.cursor = '';
                rpsButtons.forEach(b => b.style.cursor = '');

                calcState.classList.add('hidden');
                resultState.classList.remove('hidden');

                const computerChoice = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
                const isTie = userChoice === computerChoice;
                const isUserWinner = !isTie && this.BEATS[userChoice] === computerChoice;

                if (isTie) this.state.ties++;
                else if (isUserWinner) this.state.userScore++;
                else this.state.computerScore++;
                this.state.isGameOver = this.state.userScore >= this.WIN_SCORE || this.state.computerScore >= this.WIN_SCORE;

                // if (this.state.isGameOver) this.saveToHistory();

                this.state.lastRound = {
                    round: !this.state.isGameOver ? this.state.roundCounter++ : this.state.roundCounter,
                    userLabel: this.NAMES[userChoice],
                    computerLabel: this.NAMES[computerChoice],
                    isTie,
                    isUserWinner,
                };

                this.state.roundHistory.push(this.state.lastRound);

                this.renderRound();
                this.renderGameState();

                confirmBtn.focus();
            }, CONFIG.pauseTimeAfterProgress);
        };

        progressBar.addEventListener('transitionend', e => {
            if (e.propertyName === 'width') finalizeRound();
        }, { once: true });
        setTimeout(finalizeRound, thinkTime + 20);
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

        const userSelectionIcon = roundWindow.querySelector('span.icon.user-selection');
        const computerSelectionIcon = roundWindow.querySelector('span.icon.computer-selection');

        [userSelectionIcon, computerSelectionIcon].forEach(icon => {
            icon.classList.remove('icon-rock', 'icon-paper', 'icon-scissors');
        });

        userSelectionIcon.classList.add(`icon-${round.userLabel.toLowerCase()}`);
        computerSelectionIcon.classList.add(`icon-${round.computerLabel.toLowerCase()}`);

        const resultMessage = roundWindow.querySelector('.result-message');

        const userFieldset = roundWindow.querySelector('fieldset:nth-child(1)');
        const computerFieldset = roundWindow.querySelector('fieldset:nth-child(2)');

        [userFieldset, computerFieldset].forEach(fieldset => fieldset.classList.remove('winner', 'dimmed'));

        const userLabel = userFieldset.querySelector('legend span:not(.icon)');
        userLabel.textContent = authApp.currentUser;

        if (round.isTie) {
            resultMessage.textContent = `It’s a tie!`;
            confirmBtn.textContent = this.TIE_PHRASES[Math.floor(Math.random() * this.TIE_PHRASES.length)];
        } else if (round.isUserWinner) {
            userFieldset.classList.add('winner');
            computerFieldset.classList.add('dimmed');
            resultMessage.textContent = `You Win! ${round.userLabel} beats ${round.computerLabel}`;
            confirmBtn.textContent = this.WIN_PHRASES[Math.floor(Math.random() * this.WIN_PHRASES.length)];
        } else {
            userFieldset.classList.add('dimmed');
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

        const isUserWinner = this.state.userScore > this.state.computerScore;

        finalWindow.querySelector('.final-result').textContent = `${isUserWinner ? authApp.currentUser : 'Computer'}`;

        const finalEmoji = finalWindow.querySelector('.flex-container .icon-emoji');
        const currentState = finalEmoji.dataset.state ?? null;
        let availableStates = isUserWinner ? this.EMOJI_WON : this.EMOJI_LOST;
        availableStates = availableStates.filter(state => state !== currentState);
        const newState = availableStates[Math.floor(Math.random() * availableStates.length)];

        if (currentState) finalEmoji.classList.remove(`icon-${currentState}`);
        finalEmoji.classList.add(`icon-${newState}`);
        finalEmoji.dataset.state = newState;

        const winnerIcon = finalWindow.querySelector('.winner-text .icon');
        winnerIcon.classList.remove('icon-user', 'icon-computer');
        winnerIcon.classList.add(isUserWinner ? 'icon-user' : 'icon-computer');

        const finalStats = {
            total: this.state.roundCounter,
            winrate: this.state.winrate,
            user: this.state.userScore,
            computer: this.state.computerScore,
            ties: this.state.ties,
        };

        Object.entries(finalStats).forEach(([stat, value]) => {
            finalWindow.querySelector(`.stats-box .stat-${stat}`).textContent = value;
        });

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

        this.renderHistoryWindow();
        if (isUserWinner) audioManager.play('levelup');
        else audioManager.play('explosion');

        windowManager.focus(finalWindow);
        finalWindow.querySelector('button.new').focus();
    },
};

rpsGame.init();

appRegistry.register('rps', {
    onClose: () => {
        rpsGame.reset();
    }
});

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
};

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
                systemManager.bootSequence();
            }
        });

        const btnYes = logoffWindow.querySelector('button[data-choice="yes"]');
        const btnNo = logoffWindow.querySelector('button[data-choice="no"]');

        appRegistry.register('logoff', {
            onOpen: () => {
                btnYes.focus();
                systemManager.showOverlay(logoffWindow);
            },
            onClose: () => {
                systemManager.hideOverlay();
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
            const isValidName = /^[a-zA-Z0-9]+$/.test(newName) && newName.length > 0 && newName.length <= 10;

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
        const textSpan = document.querySelector('button[data-app="logoff"] .logoff-text');
        if (textSpan) {
            textSpan.textContent = `Log Off ${this.currentUser}...`;
        }
    },
};

authApp.init();

const shutdownApp = {
    init: function () {
        const shutdownWindow = document.querySelector('.shutdown-window');

        appRegistry.register('shutdown', {
            onOpen: () => {
                shutdownWindow.querySelector('button[data-choice="yes"]').focus();
                systemManager.showOverlay(shutdownWindow);
            },

            onClose: () => systemManager.hideOverlay(),
        });

        shutdownWindow.querySelectorAll('button').forEach(b => {
            b.addEventListener('click', () => {
                appManager.close('shutdown');
                if (b.dataset.choice === 'yes') this.shutdown();
            });
        });
    },

    shutdown: function () {
        document.body.style.userSelect = 'none';
        systemManager.shutdownSequence();
    },
};

shutdownApp.init();

// system-manager

const systemManager = {
    wait: ms => new Promise(resolve => setTimeout(resolve, Math.random() * 200 + ms)),
    show: elements => elements.forEach(e => e.classList.remove('boot-hidden')),
    hide: elements => elements.forEach(e => e.classList.add('boot-hidden')),

    showOverlay: function (targetWindow) {
        if (!document.querySelector('.shutdown-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'shutdown-overlay';
            overlay.style.zIndex = targetWindow.style.zIndex - 1;

            overlay.addEventListener('mousedown', e => {
                e.stopPropagation();
                e.preventDefault();
                audioManager.play('warning');
            });
            document.body.appendChild(overlay);
        }
    },

    hideOverlay: function () {
        const overlay = document.querySelector('.shutdown-overlay');
        if (overlay) overlay.remove();
    },

    lockUI: function () {
        if (!document.querySelector('.ui-locker')) {
            const locker = document.createElement('div');
            locker.className = 'ui-locker';
            document.body.appendChild(locker);
        }
    },

    unlockUi: function () {
        const locker = document.querySelector('.ui-locker');
        if (locker) locker.remove();
    },

    showDialog: function ({ title = 'Warning', message = '', type = 'warning', onClick, dataChoices = ['ok'], dataApp }) {
        const dialogWindow = document.querySelector('.window.dialog-window');
        const dialogButtonSection = dialogWindow.querySelector('.dialog-content section');

        if (dataApp) dialogWindow.dataset.app = dataApp;
        else delete dialogWindow.dataset.app;

        dialogWindow.querySelector('.title-bar-text').textContent = title;
        dialogWindow.querySelector('.dialog-content p').textContent = message;
        dialogWindow.querySelector('.dialog-content .icon').className = `icon icon-emoji icon-${type}`;
        dialogButtonSection.replaceChildren();

        const closeDialog = e => {
            windowManager.close(dialogWindow);
            systemManager.hideOverlay();
            dialogWindow.querySelectorAll('button').forEach(btn => btn.removeEventListener('click', closeDialog));
            if (typeof onClick === 'function') onClick(e);
        }

        dataChoices.forEach(dataChoice => {
            const btn = document.createElement('button');
            btn.dataset.choice = dataChoice;
            btn.textContent = dataChoice.charAt(0).toUpperCase() + dataChoice.slice(1);
            dialogButtonSection.append(btn);
        });

        dialogWindow.querySelectorAll('button').forEach(btn => btn.addEventListener('click', closeDialog));

        audioManager.play(type);
        windowManager.focus(dialogWindow);
        systemManager.showOverlay(dialogWindow);
        const firstBtn = dialogButtonSection.querySelector('button');
        if (firstBtn) firstBtn.focus();
    },

    groups: {
        desktopItems: document.querySelectorAll('.desktop-item'),
        footer: document.querySelectorAll('.footer'),
        clock: document.querySelectorAll('.clock'),
        taskbarItems: document.querySelectorAll('.taskbar-items .taskbar-item'),
    },

    bootSequence: async function () {
        this.lockUI();
        Object.values(this.groups).forEach(this.hide);

        document.body.classList.remove('is-logged-off');

        await this.wait(400);
        this.show(this.groups.footer);
        audioManager.play('login');
        for (const item of this.groups.desktopItems) {
            await this.wait(150);
            this.show([item]);
        }


        await this.wait(400);
        this.show(this.groups.clock);

        await this.wait(2000);
        appManager.open('rps');

        await this.wait(400);
        this.show(this.groups.taskbarItems);
        this.unlockUi();
    },

    shutdownSequence: async function () {
        this.lockUI();
        await this.wait(400);
        this.hide(this.groups.taskbarItems);
        audioManager.play('logoff');

        await this.wait(400);

        for (const state of appManager.states.values()) {
            if (state.open) {
                await this.wait(100);
                appManager.close(state.appId)
            };
        }

        await this.wait(400);
        clock.stop();
        this.hide(this.groups.clock);

        for (const item of this.groups.desktopItems) {
            await this.wait(50);
            this.hide([item]);
        }

        await this.wait(1000);
        this.hide(this.groups.footer);

        await this.wait(400);
        document.body.classList.add('is-logged-off');

        await this.wait(3000);
        document.body.replaceChildren();
        this.unlockUi();

        const shutdownMessage = document.createElement('p');
        shutdownMessage.textContent = 'It is now safe to turn off your monitor.';
        document.body.appendChild(shutdownMessage);
        document.body.classList.add('is-turned-off');
    },

    refresh: async function () {
        await this.wait(100);
        location.reload();
    }
};

const audioManager = {
    sounds: {},
    isActivated: false,
    init: function () {
        this.sounds = {
            click: new Audio('sounds/click.mp3'),
            warning: new Audio('sounds/warning.wav'),
            login: new Audio('sounds/intro.mp3'),
            logoff: new Audio('sounds/outro_3.mp3'),
            explosion: new Audio('sounds/explosion.mp3'),
            levelup: new Audio('sounds/levelup.mp3'),
        };

        Object.values(this.sounds).forEach(audio => {
            audio.preload = 'audio';
        });

        const activateAudio = () => {
            if (this.isActivated) return;
            this.isActivated = true;

            const silentPlay = this.sounds.click.cloneNode();
            silentPlay.volume = 0;
            silentPlay.play().catch(() => { });

            document.removeEventListener('pointerdown', activateAudio);
            document.removeEventListener('keydown', activateAudio);
        }

        document.addEventListener('pointerdown', activateAudio);
        document.addEventListener('keydown', activateAudio);

        document.body.addEventListener('click', e => {
            if (e.target.closest('[data-just-dragged="true"]')) return;

            const isClickable = e.target.closest('button, a');
            if (isClickable) this.play('click', 0.5);
        });
    },

    play: function (soundName, volume = 1.0) {
        if (!this.sounds[soundName]) {
            console.warn(`Sound "${soundName}" not found.`);
            return;
        }

        const soundClone = this.sounds[soundName].cloneNode();
        soundClone.volume = volume;
        soundClone.play().catch(e => {
            console.warn('Audio error');
        });
    }
};

audioManager.init();

const contextMenuManager = {
    menuElement: document.querySelector('.context-menu'),

    init: function () {
        document.addEventListener('contextmenu', e => {
            e.preventDefault();
            if (!e.target.closest('.content') && !e.target.closest('.desktop-item') || e.target.closest('.window')) return;

            this.closeMenu();

            const targetDesktopItem = e.target.closest('.desktop-item');
            let menuItems = [];

            if (targetDesktopItem) {
                targetDesktopItem.focus();
                menuItems = [
                    { label: 'Open', action: () => appManager.open(targetDesktopItem.dataset.app) },
                    { divider: true },
                    { label: 'Rename', action: () => handleRenameLabel(targetDesktopItem, targetDesktopItem.querySelector('.desktop-item-label'), targetDesktopItem) },
                    { label: 'Delete', action: () => targetDesktopItem.remove() },
                ];
            } else {
                menuItems = [
                    { label: 'Refresh', action: () => systemManager.refresh() },
                    { divider: true },
                    { label: 'Properties', action: () => appManager.open('about') },
                ];
            }

            this.showMenu(e.clientX, e.clientY, menuItems);
        });

        document.addEventListener('pointerdown', e => {
            if (this.menuElement && !this.menuElement.contains(e.target)) {
                this.closeMenu();
            }
        });

        window.addEventListener('resize', () => this.closeMenu());
    },

    showMenu: function (x, y, items) {
        this.menuElement.replaceChildren();

        items.forEach(item => {
            if (item.divider) {
                const div = document.createElement('div');
                div.className = 'divider';
                this.menuElement.appendChild(div);
            } else {
                const btn = document.createElement('button');
                btn.className = 'context-menu-item';
                btn.textContent = item.label;
                btn.addEventListener('click', () => {
                    item.action();
                    this.closeMenu();
                });
                this.menuElement.appendChild(btn);
            }
        });

        const menuWidth = this.menuElement.offsetWidth;
        const menuHeight = this.menuElement.offsetHeight;

        let posX = x;
        let posY = y;
        let originX = 'left';
        let originY = 'top';

        if (x + menuWidth > window.innerWidth) {
            posX = x - menuWidth;
            originX = 'right';
        }

        if (y + menuHeight > window.innerHeight) {
            posY = y - menuHeight;
            originY = 'bottom';
        }

        this.menuElement.style.left = `${posX}px`;
        this.menuElement.style.top = `${posY}px`;
        this.menuElement.style.transformOrigin = `${originX} ${originY}`;

        setTimeout(() => this.menuElement.classList.add('open'), 150);
    },
    closeMenu: function () {
        this.menuElement.classList.remove('open');
    },
};

contextMenuManager.init();

const selectionManager = {
    box: null,
    startX: 0,
    startY: 0,

    init: function () {
        const content = document.querySelector('.content');
        content.addEventListener('pointerdown', e => {
            if (e.target.closest('.desktop-item') || e.target.closest('.window')) {
                if (!e.target.closest('.desktop-item')) this.clearSelection();
                return;
            }
            document.body.classList.add('is-lassoing');
            this.clearSelection();
            this.startX = e.clientX;
            this.startY = e.clientY;

            this.box = document.createElement('div');
            this.box.className = 'selection-lasso';
            this.box.style.left = `${this.startX}px`;
            this.box.style.top = `${this.startY}px`;
            document.body.appendChild(this.box);

            this._onMove = this.handleMove.bind(this);
            this._onUp = this.handleUp.bind(this);

            document.addEventListener('pointermove', this._onMove);
            document.addEventListener('pointerup', this._onUp);
        });
    },

    handleMove: function (e) {
        const currentX = e.clientX;
        const currentY = e.clientY;
        const width = Math.abs(currentX - this.startX);
        const height = Math.abs(currentY - this.startY);
        const left = Math.min(currentX, this.startX);
        const top = Math.min(currentY, this.startY);

        this.box.style.width = `${width}px`;
        this.box.style.height = `${height}px`;
        this.box.style.left = `${left}px`;
        this.box.style.top = `${top}px`;

        this.checkIntersections(left, top, width, height);
    },

    handleUp: function () {
        if (this.box) {
            this.box.remove();
            this.box = null;
        }
        document.body.classList.remove('is-lassoing');
        document.removeEventListener('pointermove', this._onMove);
        document.removeEventListener('pointerup', this._onUp);
    },

    checkIntersections: function (boxLeft, boxTop, boxWidth, boxHeight) {
        const boxRight = boxLeft + boxWidth;
        const boxBottom = boxTop + boxHeight;

        document.querySelectorAll('.desktop-item').forEach(item => {
            const rect = item.getBoundingClientRect();
            const isOverlapping = !(
                rect.right < boxLeft ||
                rect.left > boxRight ||
                rect.bottom < boxTop ||
                rect.top > boxBottom
            );
            if (isOverlapping) item.classList.add('selected');
            else item.classList.remove('selected');
        });
    },

    clearSelection: function () {
        document.querySelectorAll('.desktop-item').forEach(item => {
            item.classList.remove('selected');
        });
    }
};

selectionManager.init();

appManager.open('rps');