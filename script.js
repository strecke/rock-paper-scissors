function getComputerChoice() {
    return ['r', 'p', 's'][Math.floor(Math.random() * 3)];
}

function getHumanChoice(){
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
        const state = isTie ? 'Tie.' : isHumanWinner ? 'You Win!' : 'You Lose!';
        let roundMessage = `${state} `;

        if (isTie) {
            roundMessage += `${NAMES[humanChoice]} equals ${NAMES[computerChoice]}`
        } else {
            isHumanWinner ? humanScore++ : computerScore++;
            roundMessage += isHumanWinner
            ? `${NAMES[humanChoice]} beats ${NAMES[computerChoice]}`
            : `${NAMES[computerChoice]} beats ${NAMES[humanChoice]}`;
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
        : humanScore > computerScore ? 'Human wins.'
        : 'Computer wins.';
    const humanMessage = `Human: ${humanScore} Points`;
    const computerMessage = `Computer: ${computerScore} Points`;
    console.log(`Final score:\n${humanMessage}\n${computerMessage}\n${winnerMessage}`);
}
// init start
playGame();