function getComputerChoice() {
    return ['r', 'p', 's'][Math.floor(Math.random() * 3)];
}

function getHumanChoice() {
    const choice = prompt('Choose rock: r, paper: p, scissors: s')?.toLowerCase();
    if (!choice || choice.length !== 1 || !/^[rps]$/.test(choice)) return;
    return choice;
}

const BEATS = { r: 's', p: 'r', s: 'p', };
const NAMES = { r: 'Rock', p: 'Paper', s: 'Scissors', };

function playGame() {
    let humanScore = 0;
    let computerScore = 0;

    function playRound(humanChoice, computerChoice) {
        if (humanChoice === undefined) return;
        const isTie = humanChoice === computerChoice;
        const isHumanWinner = BEATS[humanChoice] === computerChoice;
        let roundMessage;

        if (isTie) {
            roundMessage = `Tie. ${NAMES[humanChoice]} equals ${NAMES[computerChoice]}`
        } else {
            isHumanWinner ? humanScore++ : computerScore++;
            roundMessage = isHumanWinner
                ? `You Win! ${NAMES[humanChoice]} beats ${NAMES[computerChoice]}`
                : `You Lose! ${NAMES[computerChoice]} beats ${NAMES[humanChoice]}`;
        }

        console.log(roundMessage);
    }

    for (i = 0; i <= 4; i++) {
        console.log(`Round ${i + 1}`);
        const humanSelection = getHumanChoice();
        const computerSelection = getComputerChoice();
        playRound(humanSelection, computerSelection);
    }

    const winnerMessage = humanScore === computerScore ? 'Tie.'
        : humanScore > computerScore ? 'You Win.'
            : 'Computer wins.';
    const humanMessage = `Human: ${humanScore} Points`;
    const computerMessage = `Computer: ${computerScore} Points`;
    console.log(`Final score:\n${humanMessage}\n${computerMessage}\n${winnerMessage}`);
    alert(`Final score:\n${humanMessage}\n${computerMessage}\n${winnerMessage}`);
}
// init start
//playGame();

// start menu
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
    console.log('contentRect', contentRect);
    windows.forEach(win => {
        const titleBar = win.querySelector('.title-bar');
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        let winDimensions = { x: 0, y: 0 };

        win.addEventListener('mousedown', () => {
            setWindowFocus(win);
        });

        titleBar.addEventListener('mousedown', e => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            contentRect = content.getBoundingClientRect();
            const rect = win.getBoundingClientRect();
            winDimensions = { x: rect.width, y: rect.height };
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            win.style.transform = 'none';
            win.style.left = rect.left + 'px';
            win.style.top = rect.top + 'px';
        });

        document.addEventListener('mousemove', e => {
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

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    });
}

moveWindow();

console.log(windows.length)

let windowStack = [...windows];

function setWindowFocus(win) {
    windowStack = windowStack.filter(w => w !== win);
    windowStack.push(win);
    windowStack.forEach((w, i) => {
        w.style.zIndex = i + 1;
        w.classList.remove('active');
    });
    win.classList.add('active');
}