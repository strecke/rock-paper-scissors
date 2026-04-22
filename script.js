// non-game-logic
const CONFIG = {
    startMenuHoverDelay: 250,
    dragSoundPreventionMs: 50,
    doubleClickThreshold: 300,
    pauseTimeAfterProgress: 300,
    dragThreshold: 4,
    maxMinDurationFactor: 1.4,
};

const UI_STATE = {
    active: 'active',
    closed: 'close',
    minimized: 'minimized',
    hidden: 'hidden',
    open: 'open',
};

const startMenuManager = {
    ui: {},
    folderTimeout: null,
    isProgrammaticBlur: false,

    init: function () {
        this.cacheDOM();
        this.bindEvents();
    },

    cacheDOM: function () {
        this.ui.container = document.querySelector('.start-menu-container');
        this.ui.button = this.ui.container.querySelector('.start-menu-button');
        this.ui.menu = this.ui.container.querySelector('.start-menu');
        this.ui.topLevelItems = document.querySelectorAll('.start-menu > .start-items > li');
        this.ui.submenus = document.querySelectorAll('.has-submenu');
    },

    bindEvents: function () {
        this.ui.button.addEventListener('click', e => this.toggleStartMenu());

        document.addEventListener('pointerdown', e => {
            if (!this.ui.menu.contains(e.target) && !this.ui.button.contains(e.target)) {
                if (this.ui.menu.classList.contains(UI_STATE.open)) this.toggleStartMenu(true);
            }
        });

        this.ui.menu.addEventListener('click', e => {
            const targetBtn = e.target.closest('a, button');
            if (!targetBtn) return;
            const parentLi = targetBtn.closest('li');
            if (parentLi && parentLi.classList.contains('has-submenu')) {
                clearTimeout(this.folderTimeout);
                const activeEl = document.activeElement;
                if (activeEl && this.ui.menu.contains(activeEl) && !parentLi.contains(activeEl)) {
                    this.isProgrammaticBlur = true;
                    activeEl.blur();
                    this.isProgrammaticBlur = false;
                }

                this.ui.topLevelItems.forEach(item => {
                    if (item !== parentLi) item.classList.remove(UI_STATE.open);
                });
                parentLi.classList.add(UI_STATE.open);
                return;
            }

            this.toggleStartMenu(true);
            if (targetBtn.dataset.app) appManager.open(targetBtn.dataset.app);
        });

        this.ui.menu.addEventListener('transitionend', e => {
            if (e.propertyName === 'max-height' && this.ui.menu.classList.contains(UI_STATE.open)) {
                this.ui.menu.style.overflow = 'visible';
            }
        });

        this.ui.topLevelItems.forEach(li => {
            li.addEventListener('pointerenter', () => {
                clearTimeout(this.folderTimeout);

                this.folderTimeout = setTimeout(() => {
                    const activeEl = document.activeElement;
                    if (activeEl && this.ui.menu.contains(activeEl) && !li.contains(activeEl)) {
                        this.isProgrammaticBlur = true;
                        activeEl.blur();
                        this.isProgrammaticBlur = false;
                    }

                    this.ui.topLevelItems.forEach(item => {
                        if (item !== li) item.classList.remove(UI_STATE.open);
                    });

                    if (li.classList.contains('has-submenu')) {
                        li.classList.add(UI_STATE.open);
                    }
                }, CONFIG.startMenuHoverDelay);
            });

            li.addEventListener('pointerleave', () => clearTimeout(this.folderTimeout));

            li.addEventListener('focusin', () => {
                clearTimeout(this.folderTimeout);

                this.ui.topLevelItems.forEach(item => {
                    if (item !== li) item.classList.remove(UI_STATE.open);
                });
                if (li.classList.contains('has-submenu')) li.classList.add(UI_STATE.open);
            });
        });

        this.ui.menu.addEventListener('focusin', () => {
            if (!this.ui.menu.classList.contains(UI_STATE.open)) this.toggleStartMenu();
        });

        this.ui.container.addEventListener('focusout', e => {
            if (this.isProgrammaticBlur) return;
            if (!this.ui.container.contains(e.relatedTarget)) this.toggleStartMenu(true);
        });

        this.ui.menu.addEventListener('scroll', () => this.ui.menu.scrollTop = 0);
    },

    toggleStartMenu: function (forceClose) {
        this.ui.menu.style.overflow = 'hidden';
        if (forceClose || this.ui.menu.classList.contains(UI_STATE.open)) {
            this.ui.menu.classList.remove(UI_STATE.open);
            this.ui.button.classList.remove(UI_STATE.active);
            this.ui.submenus.forEach(item => item.classList.remove(UI_STATE.open));
        } else {
            this.ui.menu.classList.add(UI_STATE.open);
            this.ui.button.classList.add(UI_STATE.active);
            windowManager.stack.forEach(w => w.classList.remove(UI_STATE.active));
            eventBus.emit('app:focused', null);
        }
    },
};

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

// desktop-item-logic

const interactionManager = {
    contentContainer: null,

    init: function () {
        this.contentContainer = document.querySelector('.content');
        window.addEventListener('resize', () => this.enforceBoundariesOnResize());
    },

    moveElement: function (element, x, y, drag) {
        const newPos = this.getPosBoundaryCheck(x, y, drag.dimensions);
        element.style.left = newPos.x + 'px';
        element.style.top = newPos.y + 'px';
    },

    makeDraggable: function (dragTarget, moveTarget, options = {}) {
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
                interactionManager.moveElement(moveTarget, x, y, interaction);
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
    },

    getPosBoundaryCheck: function (x, y, dimensions) {
        const contentRect = this.contentContainer.getBoundingClientRect();
        let newPosLeft = x;
        let newPosTop = y;
        newPosLeft = newPosLeft < 0
            ? 0 : newPosLeft + dimensions.x > contentRect.right
                ? contentRect.right - dimensions.x : newPosLeft;

        newPosTop = newPosTop < 0
            ? 0 : newPosTop + dimensions.y > contentRect.bottom
                ? contentRect.bottom - dimensions.y : newPosTop;
        return { x: newPosLeft, y: newPosTop };
    },

    enforceBoundariesOnResize: function () {
        const movableElements = document.querySelectorAll('.window[style*="left"], .desktop-item[style*="left"');

        movableElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            let currentLeft = parseFloat(el.style.left);
            let currentTop = parseFloat(el.style.top);

            interactionManager.moveElement(el, currentLeft, currentTop, { dimensions: { x: rect.width, y: rect.height } });
        });
    }
};

const desktopManager = {
    items: [],

    init: function () {
        this.items = document.querySelectorAll('.desktop-item');
        this.bindEvents();
    },

    detectDropTargetIsWindow: function (e, dI) {
        dI.style.pointerEvents = 'none';
        const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
        dI.style.pointerEvents = '';
        return !!elementBelow?.closest('.window');
    },

    bindEvents: function () {
        this.items.forEach(dI => {
            let startPos = { x: 0, y: 0 };
            let isOverWindow = false;
            let initialTarget = null;
            let initialActiveElement = null;
            let lastTap = 0;

            interactionManager.makeDraggable(dI, dI, {
                threshold: CONFIG.dragThreshold,
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
                        interaction.ghost.style.zIndex = zIndexManager.LAYERS.GHOSTS;
                        document.body.appendChild(interaction.ghost);
                    }
                    interactionManager.moveElement(interaction.ghost, x, y, interaction);
                    isOverWindow = this.detectDropTargetIsWindow(e, dI);
                    dI.style.cursor = isOverWindow ? 'no-drop' : '';
                },
                onEnd: (e, interaction) => {
                    dI.style.cursor = '';

                    if (interaction.moved) {
                        if (interaction.ghost) {
                            if (!isOverWindow) {
                                dI.style.left = interaction.ghost.style.left;
                                dI.style.top = interaction.ghost.style.top;
                            }
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
                            this.handleRenameLabel(dI, initialTarget, initialActiveElement);
                        }
                    }
                }
            });
        });
    },

    handleRenameLabel: function (dI, target, element) {
        const dILabel = dI.querySelector('.desktop-item-label');
        if (!(target === dILabel && element === dI)) return;

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

        editor.addEventListener('blur', () => finishRename(true));

        editor.addEventListener('pointerdown', e => e.stopPropagation());
        editor.addEventListener('dblclick', e => e.stopPropagation());
        editor.addEventListener('click', e => e.stopPropagation());

        editor.addEventListener('input', e => {
            editor.style.height = 'auto';
            editor.style.height = editor.scrollHeight + 'px';
        });

    },
};

// window-logic

const zIndexManager = {
    LAYERS: {
        DESKTOP: 0,
        WINDOW_BASE: 10,
        TASKBAR: 1000,
        START_MENU: 2000,
        SUBMENU: 2010,
        GHOSTS: 3000,
        LASSO: 4000,
        CONTEXT_MENU: 5000,
        OVERLAY: 8000,
        DIALOG: 9000,
    },

    init: function () {
        const taskbar = document.querySelector('.footer');
        if (taskbar) taskbar.style.zIndex = this.LAYERS.TASKBAR;
        const startMenu = document.querySelector('.start-menu');
        if (startMenu) startMenu.style.zIndex = this.LAYERS.START_MENU;
        document.querySelectorAll('.submenu').forEach(submenu => {
            submenu.style.zIndex = this.LAYERS.SUBMENU;
        });

        const contextMenu = document.querySelector('.context-menu');
        if (contextMenu) contextMenu.style.zIndex = this.LAYERS.CONTEXT_MENU;
    },

    applyWindowStack: function (stack) {
        stack.forEach((win, i) => {
            win.style.zIndex = this.LAYERS.WINDOW_BASE + i;
        });
    },
};

const windowManager = {
    stack: [],

    init: function () {
        const allWindows = document.querySelectorAll('.window');
        this.stack = [...allWindows];

        allWindows.forEach(win => this.register(win));
    },

    register: function (win) {
        const titleBar = win.querySelector('.title-bar');

        win.addEventListener('pointerdown', () => this.focus(win));

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

        interactionManager.makeDraggable(titleBar, win, {
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
                    interaction.ghost.style.zIndex = zIndexManager.LAYERS.GHOSTS;
                    interaction.ghost.style.width = interaction.dimensions.x + 'px';
                    interaction.ghost.style.height = interaction.dimensions.y + 'px';
                    document.body.appendChild(interaction.ghost);
                }
                interactionManager.moveElement(interaction.ghost, x, y, interaction);
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
    },

    getFocusedAppId: function () {
        const topWindow = this.stack.findLast(w =>
            !w.classList.contains(UI_STATE.closed) &&
            !w.classList.contains(UI_STATE.minimized) &&
            w.classList.contains(UI_STATE.active)
        );
        return topWindow ? topWindow.dataset.app : null;
    },

    focus: function (win) {
        if (!win) return;

        const appId = win.dataset.app;

        eventBus.emit('app:focused', appId);

        // taskbarManager.setActiveApp(appId);

        if (win.classList.contains(UI_STATE.active)) return;

        this.stack = this.stack.filter(w => w !== win);
        this.stack.push(win);
        this.stack.forEach((w, i) => w.classList.remove(UI_STATE.active));
        zIndexManager.applyWindowStack(this.stack);
        win.classList.add(UI_STATE.active);
        win.classList.remove(UI_STATE.closed);
        win.focus();
    },

    close: function (win) {
        win.classList.add(UI_STATE.closed);
        win.classList.remove(UI_STATE.active);
        const newWindowFocus = this.stack.findLast(w =>
            !w.classList.contains(UI_STATE.closed) && !w.classList.contains(UI_STATE.minimized)
        );

        if (newWindowFocus) this.focus(newWindowFocus);
        else taskbarManager.setActiveApp(null);
    },
};

// application-logic

const appManager = {
    states: new Map(),

    init: function () {
        const allWindows = document.querySelectorAll('.window');

        allWindows.forEach(win => {
            const appId = win.dataset.app;
            if (!this.states.has(appId)) {
                this.states.set(appId, {
                    appId,
                    open: false,
                    minimized: false,
                    windows: [],
                });
            }
            this.states.get(appId).windows.push(win);
        });
    },

    getState: function (appId) {
        return this.states.get(appId);
    },

    open: function (appId) {
        const state = this.getState(appId);
        if (!state || !state.windows.length) return;

        const lastFocused = windowManager.stack.findLast(w =>
            w.dataset.app === appId && !w.classList.contains(UI_STATE.closed));

        const windowToFocus = lastFocused || state.windows.find(w => w.classList.contains('main-window')) || state.windows[0];

        if (state.minimized) {
            this.maximize(appId, state.windows, windowToFocus);
        } else {
            windowToFocus.classList.remove(UI_STATE.minimized, UI_STATE.closed);
        }

        state.open = true;
        state.minimized = false;

        windowManager.focus(windowToFocus);

        eventBus.emit('app:opened', appId);
    },

    close: function (appId) {
        const state = this.getState(appId);
        if (!state) return;

        const visibleWindows = state.windows.filter(w => !w.classList.contains(UI_STATE.closed));

        visibleWindows.forEach(win => windowManager.close(win));

        state.open = false;
        state.minimized = false;

        eventBus.emit('app:closed', appId);
    },

    maximize: function (appId, appWindows, windowToFocus) {
        const taskbarButton = taskbarManager.items[appId];

        if (taskbarButton) {
            const titleBar = windowToFocus.querySelector('.title-bar');
            windowToFocus.style.visibility = 'hidden';
            windowToFocus.classList.remove(UI_STATE.minimized);

            const endRect = titleBar.getBoundingClientRect();
            const startRect = taskbarButton.getBoundingClientRect();

            const distance = Math.hypot(endRect.left - startRect.left, endRect.top - startRect.top);
            const duration = distance / CONFIG.maxMinDurationFactor;

            const ghostTitleBar = document.createElement('div');
            ghostTitleBar.className = 'title-bar ghost-title-bar';
            const titleText = windowToFocus.querySelector('.title-bar-text').cloneNode(true);
            ghostTitleBar.appendChild(titleText);

            ghostTitleBar.style.left = `${startRect.left}px`;
            ghostTitleBar.style.top = `${startRect.top}px`;
            ghostTitleBar.style.width = `${startRect.width}px`;
            ghostTitleBar.style.height = `${startRect.height}px`;
            ghostTitleBar.style.transition = `all ${duration}ms linear`;

            ghostTitleBar.style.zIndex = zIndexManager.LAYERS.GHOSTS;

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
                appWindows.forEach(win => win.classList.remove(UI_STATE.minimized));
            });
        } else {
            // fallback no taskbar-button
            appWindows.forEach(win => win.classList.remove(UI_STATE.minimized));
        }
    },

    minimize: function (appId) {
        const state = this.getState(appId);
        if (!state) return;
        const visibleWindows = state.windows.filter(w => !w.classList.contains(UI_STATE.closed) && !w.classList.contains(UI_STATE.minimized));
        if (!visibleWindows.length) return;

        const activeWindow = visibleWindows.find(w => w.classList.contains(UI_STATE.active)) || visibleWindows[0];
        const taskbarButton = taskbarManager.items[appId];

        const finalizeMinimize = () => {
            state.minimized = true;

            visibleWindows.forEach(win => {
                win.classList.add(UI_STATE.minimized);
                win.classList.remove(UI_STATE.active);
            });

            eventBus.emit('app:minimized', appId);

            const newWindowFocus = windowManager.stack.findLast(w =>
                !w.classList.contains(UI_STATE.closed) && !w.classList.contains(UI_STATE.minimized)
            );
            if (newWindowFocus) windowManager.focus(newWindowFocus);
            else taskbarManager.setActiveApp(null);
        };

        if (activeWindow && taskbarButton) {
            const titleBar = activeWindow.querySelector('.title-bar');
            const startRect = titleBar.getBoundingClientRect();
            const endRect = taskbarButton.getBoundingClientRect();

            const distance = Math.hypot(endRect.left - startRect.left, endRect.top - startRect.top);
            const duration = distance / CONFIG.maxMinDurationFactor;

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

            ghostTitleBar.style.zIndex = zIndexManager.LAYERS.GHOSTS;

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

    toggle: function (appId) {
        const isFocused = windowManager.getFocusedAppId() === appId;

        if (isFocused) this.minimize(appId);
        else this.open(appId);
    }
};

const eventBus = {
    listeners: {},

    on: function (eventName, callback) {
        if (!this.listeners[eventName]) this.listeners[eventName] = [];
        this.listeners[eventName].push(callback);
    },

    emit: function (eventName, data) {
        if (this.listeners[eventName]) {
            this.listeners[eventName].forEach(callback => callback(data));
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

        eventBus.on('app:opened', appId => {
            this.items[appId]?.classList.remove(UI_STATE.closed);
        });

        eventBus.on('app:closed', appId => {
            this.setStatus(appId, UI_STATE.closed);
        });

        eventBus.on('app:focused', appId => {
            this.setActiveApp(appId);
        });
    },

    setStatus: function (appId, status) {
        const item = this.items[appId];
        if (!item) return;
        item.classList.remove(UI_STATE.active, UI_STATE.closed);
        if (status) item.classList.add(status);
    },

    setActiveApp: function (activeAppId) {
        Object.keys(this.items).forEach(id => {
            const item = this.items[id];
            item.classList.remove(UI_STATE.active);
            if (id === activeAppId) item.classList.add(UI_STATE.active);
        });
    }
};

// game-logic

const rpsGame = {
    WIN_SCORE: 5,
    BEATS: { rock: 'scissors', paper: 'rock', scissors: 'paper' },
    NAMES: { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' },
    state: {},
    globalHistory: [],
    isLocalStorageEnabled: null,
    ui: {},

    init: function () {
        this.cacheDOM();
        this.initStorage();
        this.bindEvents();
        this.reset();

        eventBus.on('app:closed', closedAppId => {
            if (closedAppId === 'rps') this.reset();
        });
    },

    cacheDOM: function () {
        this.ui.gameWindow = document.querySelector('.game-window[data-app="rps"]');
        this.ui.roundWindow = document.querySelector('.round-window[data-app="rps"]');
        this.ui.finalWindow = document.querySelector('.final-window[data-app="rps"]');
        this.ui.historyWindow = document.querySelector('.history-window[data-app="rps"]');

        // game window elements
        this.ui.rpsButtons = document.querySelectorAll('.game-window[data-app="rps"] .game-content section button');
        this.ui.progressBarIndicator = this.ui.gameWindow.querySelector('.progress-indicator-bar');

        // round window elements
        this.ui.roundTitle = this.ui.roundWindow.querySelector('.title-bar-text');
        this.ui.userSelectionText = this.ui.roundWindow.querySelector('p.user-selection');
        this.ui.computerSelectionText = this.ui.roundWindow.querySelector('p.computer-selection');
        this.ui.userIcon = this.ui.roundWindow.querySelector('span.icon.user-selection');
        this.ui.computerIcon = this.ui.roundWindow.querySelector('span.icon.computer-selection');
        this.ui.resultMessage = this.ui.roundWindow.querySelector('.result-message');
        this.ui.confirmBtn = this.ui.roundWindow.querySelector('button');
        this.ui.userFieldset = this.ui.roundWindow.querySelector('fieldset:nth-child(1)');
        this.ui.computerFieldset = this.ui.roundWindow.querySelector('fieldset:nth-child(2)');
        this.ui.userLabel = this.ui.userFieldset.querySelector('legend span:not(.icon)');
        this.ui.userPointsText = this.ui.roundWindow.querySelector('.users-points');
        this.ui.computerPointsText = this.ui.roundWindow.querySelector('.computers-points');
        this.ui.calcState = this.ui.roundWindow.querySelector('.calculating-state');
        this.ui.resultState = this.ui.roundWindow.querySelector('.result-state');
        this.ui.stepProgressBar = this.ui.roundWindow.querySelector('.step-progress-bar');
        this.ui.progressIndicator = this.ui.roundWindow.querySelector('.progress-indicator');

        // final window elements
        this.ui.finalUserName = this.ui.finalWindow.querySelector('.table table thead .current-user');
        this.ui.finalResultText = this.ui.finalWindow.querySelector('.final-result');
        this.ui.finalEmojiIcon = this.ui.finalWindow.querySelector('.flex-container .icon-emoji');
        this.ui.finalWinnerIcon = this.ui.finalWindow.querySelector('.winner-text .icon');

        this.ui.statTotal = this.ui.finalWindow.querySelector('.stats-box .stat-total');
        this.ui.statWinrate = this.ui.finalWindow.querySelector('.stats-box .stat-winrate');
        this.ui.statUser = this.ui.finalWindow.querySelector('.stats-box .stat-user');
        this.ui.statComputer = this.ui.finalWindow.querySelector('.stats-box .stat-computer');
        this.ui.statTies = this.ui.finalWindow.querySelector('.stats-box .stat-ties');

        this.ui.finalBtnNew = this.ui.finalWindow.querySelector('button.new');
        this.ui.finalBtnExit = this.ui.finalWindow.querySelector('button.exit');
        this.ui.finalBtnHistory = this.ui.finalWindow.querySelector('button.history');
        this.ui.finalTableBody = this.ui.finalWindow.querySelector('.table table tbody');

        // history window elements
        this.ui.historyTableBody = this.ui.historyWindow.querySelector('tbody');
        this.ui.historyBtnClear = this.ui.historyWindow.querySelector('button.clear-history');

        this.ui.historyBtnsClose = this.ui.historyWindow.querySelectorAll('button.close-history');
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
        this.ui.rpsButtons.forEach(b => {
            b.addEventListener('click', () => this.handleUserChoice(b.dataset.choice));
        });

        this.ui.confirmBtn.addEventListener('click', e => {
            windowManager.close(this.ui.roundWindow);
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

        this.ui.finalBtnNew.addEventListener('click', () => {
            this.reset();
            windowManager.close(this.ui.finalWindow);
            windowManager.focus(this.ui.gameWindow);
        });

        this.ui.finalBtnExit.addEventListener('click', () => {
            this.reset();
            appManager.close('rps');
        });

        this.ui.finalBtnHistory.addEventListener('click', () => {
            windowManager.focus(this.ui.historyWindow);
            this.ui.historyBtnsClose[1].focus();
        });

        this.ui.historyBtnsClose.forEach(b => {
            b.addEventListener('click', () => windowManager.close(this.ui.historyWindow));
        });

        this.ui.historyBtnClear.addEventListener('click', () => {
            this.globalHistory = [];
            localStorage.removeItem('rps_history');
            this.isLocalStorageEnabled = null;
            this.renderEmptyHistory(this.ui.historyTableBody);
        });

        document.addEventListener('keydown', e => {
            if (!this.ui.gameWindow.classList.contains(UI_STATE.active)) return;
            const keyMap = {
                '1': 'rock',
                '2': 'paper',
                '3': 'scissors',
            };

            const choice = keyMap[e.key];
            if (!choice) return;

            const btn = this.ui.gameWindow.querySelector(`button[data-choice="${choice}"]`);
            if (btn && !btn.disabled) {
                btn.focus();
                btn.click();
            }
        });
    },

    renderHistoryWindow: function () {
        if (!this.globalHistory.length) {
            this.renderEmptyHistory(this.ui.historyTableBody);
            return;
        }

        this.ui.historyTableBody.replaceChildren();

        this.globalHistory.slice().reverse().forEach(game => {
            const tr = document.createElement('tr');

            if (game.winner === authApp.currentUser && game.isUserWinner) tr.classList.add('highlighted');
            if (!game.isUserWinner) tr.classList.add('dimmed');

            const dateTh = document.createElement('th'); dateTh.textContent = game.date;
            const winnerTh = document.createElement('th'); winnerTh.textContent = game.winner;
            const scoreTh = document.createElement('th'); scoreTh.textContent = game.score;
            const roundsTh = document.createElement('th'); roundsTh.textContent = game.totalRounds;

            tr.append(dateTh, winnerTh, scoreTh, roundsTh);
            this.ui.historyTableBody.appendChild(tr);
        });
    },

    handleUserChoice: function (userChoice) {
        this.ui.roundTitle.textContent = `Loading Round ${this.state.roundCounter}...`;

        this.ui.gameWindow.style.cursor = 'wait';
        this.ui.roundWindow.style.cursor = 'wait';
        this.ui.rpsButtons.forEach(b => {
            b.disabled = true;
            b.style.cursor = 'wait';
        });

        this.ui.calcState.classList.remove(UI_STATE.hidden);
        this.ui.resultState.classList.add(UI_STATE.hidden);

        this.ui.stepProgressBar.style.transition = 'none';
        this.ui.stepProgressBar.style.width = '0%';

        appManager.open('rps');
        windowManager.focus(this.ui.roundWindow);

        if (window.getComputedStyle(this.ui.roundWindow).transform !== 'none') {
            const rect = this.ui.roundWindow.getBoundingClientRect();

            this.ui.roundWindow.style.left = `${rect.left}px`;
            this.ui.roundWindow.style.right = `${rect.top}px`;
            this.ui.roundWindow.style.transform = 'none';
        }

        const maxContainerWidth = this.ui.progressIndicator.clientWidth - 1;
        const blockWidth = 18;

        const steps = Math.floor(maxContainerWidth / blockWidth);
        const targetWidthPx = steps * blockWidth;

        const thinkTime = steps * Math.floor(Math.random() * 60) + 60;

        // const pauseTime = 1000 - thinkTime;

        this.ui.stepProgressBar.offsetHeight;


        this.ui.stepProgressBar.style.transition = `width ${thinkTime}ms steps(${steps}, end)`;
        this.ui.stepProgressBar.style.width = `${targetWidthPx}px`;

        let isRoundProcessed = false;
        const finalizeRound = () => {
            if (isRoundProcessed) return;
            isRoundProcessed = true;
            setTimeout(() => {
                this.ui.gameWindow.style.cursor = '';
                this.ui.roundWindow.style.cursor = '';
                this.ui.rpsButtons.forEach(b => b.style.cursor = '');

                this.ui.calcState.classList.add(UI_STATE.hidden);
                this.ui.resultState.classList.remove(UI_STATE.hidden);

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

                this.ui.confirmBtn.focus();
            }, CONFIG.pauseTimeAfterProgress);
        };

        this.ui.stepProgressBar.addEventListener('transitionend', e => {
            if (e.propertyName === 'width') finalizeRound();
        }, { once: true });
        setTimeout(finalizeRound, thinkTime + 20);
    },

    WIN_PHRASES: ['Hurray!', 'Awesome!', 'Take that!', 'Finally!', 'Let’s go!'],
    LOSE_PHRASES: ['Not again...', 'Darn it!', 'Ouch...', 'Nevermind...', 'Yikes!'],
    TIE_PHRASES: ['Phew!', 'Close one!', 'Again!', 'Boring...'],

    renderRound: function () {
        const round = this.state.lastRound;

        this.ui.roundTitle.textContent = `Results Round ${round.round}`;
        this.ui.userSelectionText.textContent = `${round.userLabel}`;
        this.ui.computerSelectionText.textContent = `${round.computerLabel}`;

        [this.ui.userIcon, this.ui.computerIcon].forEach(icon => {
            icon.classList.remove('icon-rock', 'icon-paper', 'icon-scissors');
        });

        this.ui.userIcon.classList.add(`icon-${round.userLabel.toLowerCase()}`);
        this.ui.computerIcon.classList.add(`icon-${round.computerLabel.toLowerCase()}`);

        [this.ui.userFieldset, this.ui.computerFieldset].forEach(fieldset => fieldset.classList.remove('winner', 'dimmed'));

        this.ui.userLabel.textContent = authApp.currentUser;

        if (round.isTie) {
            this.ui.resultMessage.textContent = `It’s a tie!`;
            this.ui.confirmBtn.textContent = this.TIE_PHRASES[Math.floor(Math.random() * this.TIE_PHRASES.length)];
        } else if (round.isUserWinner) {
            this.ui.userFieldset.classList.add('winner');
            this.ui.computerFieldset.classList.add('dimmed');
            this.ui.resultMessage.textContent = `You Win! ${round.userLabel} beats ${round.computerLabel}`;
            this.ui.confirmBtn.textContent = this.WIN_PHRASES[Math.floor(Math.random() * this.WIN_PHRASES.length)];
        } else {
            this.ui.userFieldset.classList.add('dimmed');
            this.ui.computerFieldset.classList.add('winner');
            this.ui.resultMessage.textContent = `You Lose! ${round.computerLabel} beats ${round.userLabel}`;
            this.ui.confirmBtn.textContent = this.LOSE_PHRASES[Math.floor(Math.random() * this.LOSE_PHRASES.length)];
        }
    },

    renderGameState: function () {
        const highestPoints = Math.max(this.state.userScore, this.state.computerScore);
        const progressPercent = Math.min((highestPoints / this.WIN_SCORE) * 100, 100);

        this.ui.progressBarIndicator.style.width = progressPercent + '%';
        this.ui.userPointsText.textContent = `You: ${this.state.userScore}`;
        this.ui.computerPointsText.textContent = `Computer: ${this.state.computerScore}`;

        this.ui.rpsButtons.forEach(b => {
            b.disabled = this.state.isGameOver;
        });
    },

    EMOJI_WON: ['happy', 'wink', 'mask', 'confetti'],
    EMOJI_LOST: ['sad', 'nervous', 'melting'],

    renderFinalWindow: function () {
        this.ui.finalUserName.textContent = authApp.currentUser;

        const isUserWinner = this.state.userScore > this.state.computerScore;

        this.ui.finalResultText.textContent = `${isUserWinner ? authApp.currentUser : 'Computer'}`;

        const currentState = this.ui.finalEmojiIcon.dataset.state ?? null;
        let availableStates = isUserWinner ? this.EMOJI_WON : this.EMOJI_LOST;
        availableStates = availableStates.filter(state => state !== currentState);
        const newState = availableStates[Math.floor(Math.random() * availableStates.length)];

        if (currentState) this.ui.finalEmojiIcon.classList.remove(`icon-${currentState}`);
        this.ui.finalEmojiIcon.classList.add(`icon-${newState}`);
        this.ui.finalEmojiIcon.dataset.state = newState;

        this.ui.finalWinnerIcon.classList.remove('icon-user', 'icon-computer');
        this.ui.finalWinnerIcon.classList.add(isUserWinner ? 'icon-user' : 'icon-computer');

        const finalStats = {
            statTotal: this.state.roundCounter,
            statWinrate: this.state.winrate,
            statUser: this.state.userScore,
            statComputer: this.state.computerScore,
            statTies: this.state.ties,
        };

        Object.entries(finalStats).forEach(([stat, value]) => {
            this.ui[stat].textContent = value;
        });

        this.ui.finalTableBody.replaceChildren();
        this.state.roundHistory.forEach(round => {
            const tr = document.createElement('tr');
            if (round.isUserWinner) tr.classList.add('highlighted');
            if (round.isTie) tr.classList.add('dimmed');

            const roundTh = document.createElement('th'); roundTh.textContent = round.round;
            const userTh = document.createElement('th'); userTh.textContent = round.userLabel;
            const computerTh = document.createElement('th'); computerTh.textContent = round.computerLabel;

            tr.append(roundTh, userTh, computerTh);
            this.ui.finalTableBody.append(tr);
        });

        this.renderHistoryWindow();
        if (isUserWinner) audioManager.play('levelup');
        else audioManager.play('explosion');

        windowManager.focus(this.ui.finalWindow);
        this.ui.finalBtnNew.focus();
    },
};

// about-app

const aboutApp = {
    ui: {},
    init: function () {
        this.cacheDOM();
        this.bindEvents();
    },

    cacheDOM: function () {
        this.ui.window = document.querySelector('.about-window');
        if (!this.ui.window) return;
        this.ui.emojiBtn = this.ui.window.querySelector('.about-content button.emoji-button');
        this.ui.emojiIcon = this.ui.window.querySelector('.icon-emoji');
        this.ui.closeBtn = this.ui.window.querySelector('.about-content button[data-action]');
    },

    bindEvents: function () {
        if (this.ui.emojiBtn) {
            const states = ['happy', 'sad', 'wink', 'nervous', 'melting', 'mask', 'confetti'];

            this.ui.emojiBtn.addEventListener('click', () => {
                const currentState = this.ui.emojiIcon.dataset.state || 'happy';
                const availableStates = states.filter(state => state !== currentState);
                const newState = availableStates[Math.floor(Math.random() * availableStates.length)];

                this.ui.emojiIcon.classList.remove(`icon-${currentState}`);
                this.ui.emojiIcon.classList.add(`icon-${newState}`);
                this.ui.emojiIcon.dataset.state = newState;
            });
        }

        if (this.ui.closeBtn) {
            this.ui.closeBtn.addEventListener('click', () => {
                appManager.close('about');
            });
        }
    },
};

// auth-app

const authApp = {
    currentUser: 'User',
    ui: {},
    init: function () {
        this.cacheDom();
        this.bindEvents();
        this.updateStartMenuText();
    },

    cacheDom: function () {
        this.ui.logoffWindow = document.querySelector('.logoff-window');
        this.ui.loginWindow = document.querySelector('.login-window');

        this.ui.usernameInput = this.ui.loginWindow.querySelector('#username');
        this.ui.passwordInput = this.ui.loginWindow.querySelector('#password');

        this.ui.btnLogoffYes = this.ui.logoffWindow.querySelector('button[data-choice="yes"]');
        this.ui.btnLogoffNo = this.ui.logoffWindow.querySelector('button[data-choice="no"]');
        this.ui.btnLoginOk = this.ui.loginWindow.querySelector('button[data-choice="ok"]');
        this.ui.btnLoginCancel = this.ui.loginWindow.querySelector('button[data-choice="cancel"]');

        this.ui.startMenuLogoffText = document.querySelector('button[data-app="logoff"] .logoff-text');
    },

    bindEvents: function () {
        this.ui.usernameInput.addEventListener('input', e => {
            e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
        });

        this.ui.passwordInput.addEventListener('input', e => {
            const cursorPosition = this.ui.passwordInput.selectionStart;
            const currentLength = this.ui.passwordInput.value.length;
            this.ui.passwordInput.value = '*'.repeat(currentLength);
            this.ui.passwordInput.setSelectionRange(cursorPosition, cursorPosition);
        });

        eventBus.on('app:opened', appId => {
            if (appId === 'logoff') {
                this.ui.btnLogoffYes.focus();
                this.ui.logoffWindow.style.zIndex = zIndexManager.LAYERS.DIALOG;
                systemManager.showOverlay(this.ui.logoffWindow);
            }
        });

        eventBus.on('app:closed', appId => {
            if (appId === 'login') systemManager.bootSequence();
            else if (appId === 'logoff') systemManager.hideOverlay();
        });

        this.ui.btnLogoffNo.addEventListener('click', () => {
            appManager.close('logoff');
        });

        this.ui.btnLogoffYes.addEventListener('click', () => {
            appManager.states.forEach(state => {
                if (state.open) {
                    appManager.close(state.appId);
                }
            });
            this.renderLogin();
        });

        this.ui.btnLoginCancel.addEventListener('click', () => {
            this.cancelLogin();
        });

        this.ui.btnLoginOk.addEventListener('click', () => {
            let newName = this.ui.usernameInput.value.trim();
            const isValidName = /^[a-zA-Z0-9]+$/.test(newName) && newName.length > 0 && newName.length <= 10;

            if (!isValidName) newName = this.currentUser;
            this.currentUser = newName;
            this.updateStartMenuText();
            this.cancelLogin();
        });

        [this.ui.usernameInput, this.ui.passwordInput].forEach(input => {
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') this.ui.btnLoginOk.click();
            });
        });
    },

    renderLogin: function () {
        document.body.classList.add('is-logged-off');
        this.ui.usernameInput.value = this.currentUser;
        this.ui.passwordInput.value = '';
        appManager.open('login');
        setTimeout(() => this.ui.usernameInput.focus(), 50);
    },

    cancelLogin: function () {
        appManager.close('login');
    },

    updateStartMenuText: function () {
        if (this.ui.startMenuLogoffText) {
            this.ui.startMenuLogoffText.textContent = `Log Off ${this.currentUser}...`;
        }
    },
};

const shutdownApp = {
    ui: {},

    init: function () {
        this.cacheDOM();
        this.bindEvents();
    },

    cacheDOM: function () {
        this.ui.window = document.querySelector('.shutdown-window');
        if (!this.ui.window) return;
        this.ui.btnYes = this.ui.window.querySelector('button[data-choice="yes"]');
        this.ui.buttons = this.ui.window.querySelectorAll('button');
    },

    bindEvents: function () {
        eventBus.on('app:opened', openedAppId => {
            if (openedAppId === 'shutdown' && this.ui.window) {
                this.ui.btnYes.focus();
                this.ui.window.style.zIndex = zIndexManager.LAYERS.DIALOG;
                systemManager.showOverlay(this.ui.window);
            }
        });

        eventBus.on('app:closed', closedAppId => {
            if (closedAppId === 'shutdown') systemManager.hideOverlay();
        });

        if (this.ui.buttons) {
            this.ui.buttons.forEach(b => {
                b.addEventListener('click', () => {
                    appManager.close('shutdown');
                    if (b.dataset.choice === 'yes') this.shutdown();
                });
            });
        }
    },

    shutdown: function () {
        document.body.style.userSelect = 'none';
        systemManager.shutdownSequence();
    },
};

// system-manager

const systemManager = {
    groups: {},
    ui: {},
    wait: ms => new Promise(resolve => setTimeout(resolve, Math.random() * 200 + ms)),
    show: elements => elements.forEach(e => e.classList.remove('boot-hidden')),
    hide: elements => elements.forEach(e => e.classList.add('boot-hidden')),

    init: function () {
        this.cacheDOM();
        this.bindEvents();
    },

    cacheDOM: function () {
        this.ui.desktopItems = document.querySelectorAll('.desktop-item');
        this.ui.footer = document.querySelectorAll('.footer');
        this.ui.clock = document.querySelectorAll('.clock');
        this.ui.taskbarItems = document.querySelectorAll('.taskbar-items .taskbar-item');

        this.ui.dialogWindow = document.querySelector('.window.dialog-window');
        if (this.ui.dialogWindow) {
            this.ui.dialogTitle = this.ui.dialogWindow.querySelector('.title-bar-text');
            this.ui.dialogMessage = this.ui.dialogWindow.querySelector('.dialog-content p');
            this.ui.dialogIcon = this.ui.dialogWindow.querySelector('.dialog-content .icon');
            this.ui.dialogButtonSection = this.ui.dialogWindow.querySelector('.dialog-content section');
        }

    },

    bindEvents: function () {
        document.addEventListener('mousemove', () => document.body.classList.add('using-mouse'), { passive: true });
        document.addEventListener('touchstart', () => document.body.classList.remove('using-mouse'), { passive: true });

        document.body.addEventListener('keydown', e => {
            if (e.key === 'Tab') document.body.classList.remove('using-mouse');
        });

        document.addEventListener('pointerdown', e => {
            if (!e.target.closest('.window') &&
                !e.target.closest('.taskbar-item') &&
                !e.target.closest('.start-menu-container')) {
                windowManager.stack.forEach(w => w.classList.remove(UI_STATE.active));
                eventBus.emit('app:focused', null);
            }
        });
    },

    showOverlay: function (targetWindow) {
        if (!document.querySelector('.shutdown-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'shutdown-overlay';
            overlay.style.zIndex = zIndexManager.LAYERS.OVERLAY;

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
        if (dataApp) this.ui.dialogWindow.dataset.app = dataApp;
        else delete this.ui.dialogWindow.dataset.app;

        this.ui.dialogTitle.textContent = title;
        this.ui.dialogMessage.textContent = message;
        this.ui.dialogIcon.className = `icon icon-emoji icon-${type}`;
        this.ui.dialogButtonSection.replaceChildren();

        const closeDialog = e => {
            windowManager.close(this.ui.dialogWindow);
            systemManager.hideOverlay();
            this.ui.dialogWindow.querySelectorAll('button').forEach(btn => btn.removeEventListener('click', closeDialog));
            if (typeof onClick === 'function') onClick(e);
        };

        dataChoices.forEach(dataChoice => {
            const btn = document.createElement('button');
            btn.dataset.choice = dataChoice;
            btn.textContent = dataChoice.charAt(0).toUpperCase() + dataChoice.slice(1);
            this.ui.dialogButtonSection.append(btn);
        });

        this.ui.dialogWindow.querySelectorAll('button').forEach(btn => btn.addEventListener('click', closeDialog));

        audioManager.play(type);
        windowManager.focus(this.ui.dialogWindow);
        this.ui.dialogWindow.style.zIndex = zIndexManager.LAYERS.DIALOG;
        systemManager.showOverlay(this.ui.dialogWindow);
        const firstBtn = this.ui.dialogButtonSection.querySelector('button');
        if (firstBtn) firstBtn.focus();
    },

    bootSequence: async function () {
        this.lockUI();

        this.hide(this.ui.desktopItems);
        this.hide(this.ui.footer);
        this.hide(this.ui.clock);
        this.hide(this.ui.taskbarItems);

        document.body.classList.remove('is-logged-off');

        await this.wait(400);
        this.show(this.ui.footer);
        audioManager.play('login');

        for (const item of this.ui.desktopItems) {
            await this.wait(150);
            this.show([item]);
        }

        await this.wait(400);
        this.show(this.ui.clock);

        await this.wait(2000);
        appManager.open('rps');

        await this.wait(400);
        this.show(this.ui.taskbarItems);
        this.unlockUi();
    },

    shutdownSequence: async function () {
        this.lockUI();
        await this.wait(400);
        this.hide(this.ui.taskbarItems);
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
        this.hide(this.ui.clock);

        for (const item of this.ui.desktopItems) {
            await this.wait(50);
            this.hide([item]);
        }

        await this.wait(1000);
        this.hide(this.ui.footer);

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
    },
};

const audioManager = {
    sounds: {},
    isActivated: false,
    init: async function () {
        const soundFiles = {
            click: 'sounds/click.mp3',
            warning: 'sounds/warning.wav',
            login: 'sounds/intro.mp3',
            logoff: 'sounds/outro_3.mp3',
            explosion: 'sounds/explosion.mp3',
            levelup: 'sounds/levelup.mp3',
        };

        for (const [name, path] of Object.entries(soundFiles)) {
            try {
                const response = await fetch(path);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                this.sounds[name] = new Audio(blobUrl);
            } catch (e) {
                console.warn(`Sound ${name} not found.`, e);
            }
        }

        const activateAudio = () => {
            if (this.isActivated) return;
            this.isActivated = true;

            if (this.sounds.click) {
                const silentPlay = this.sounds.click.cloneNode();
                silentPlay.volume = 0;
                silentPlay.play().catch(() => { });
            }

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

const contextMenuManager = {
    menuElement: null,

    init: function () {
        this.menuElement = document.querySelector('.context-menu');
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
                    { label: 'Rename', action: () => desktopManager.handleRenameLabel(targetDesktopItem, targetDesktopItem.querySelector('.desktop-item-label'), targetDesktopItem) },
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

        setTimeout(() => this.menuElement.classList.add(UI_STATE.open), 150);
    },
    closeMenu: function () {
        this.menuElement.classList.remove(UI_STATE.open);
    },
};

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
            this.box.style.zIndex = zIndexManager.LAYERS.LASSO;
            this.box.style.left = `${this.startX}px`;
            this.box.style.top = `${this.startY}px`;
            document.body.appendChild(this.box);

            this._onMove = this.handleMove.bind(this);
            this._onUp = this.handleUp.bind(this);

            document.addEventListener('pointermove', this._onMove);
            document.addEventListener('pointerup', this._onUp);
            document.addEventListener('lostpointercapture', this._onUp);
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
        document.removeEventListener('lostpointercapture', this._onUp);
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

const OS = {
    boot: function () {
        interactionManager.init();
        zIndexManager.init();
        audioManager.init();

        desktopManager.init();
        startMenuManager.init();
        taskbarManager.init();
        contextMenuManager.init();
        selectionManager.init();
        clock.init();

        windowManager.init();
        appManager.init();

        authApp.init();
        shutdownApp.init();
        aboutApp.init();
        rpsGame.init();

        systemManager.init();

        appManager.open('rps');
    },
};

document.addEventListener('DOMContentLoaded', () => OS.boot());
