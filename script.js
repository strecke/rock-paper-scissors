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
        let message;
        if (humanChoice === computerChoice) {
            message = `Tie. ${NAMES[humanChoice]} equals ${NAMES[computerChoice]}`
        } else {
            const isHumanWinner = BEATS[humanChoice] === computerChoice;
            isHumanWinner ? humanScore++ : computerScore++;
            message = isHumanWinner
            ? `You Win! ${NAMES[humanChoice]} beats ${NAMES[computerChoice]}`
            : `You Lose! ${NAMES[computerChoice]} beats ${NAMES[humanChoice]}`;
        }
        console.log(message);
    }

    for (i = 0; i <= 4; i++) {
        console.log(`Round ${i + 1}`);
        const humanSelection = getHumanChoice();
        const computerSelection = getComputerChoice();
        playRound(humanSelection, computerSelection);
    }
    const message = humanScore === computerScore ? 'Tie.'
        : humanScore > computerScore ? 'Human wins.'
        : 'Computer wins.';
    console.log(`Final score:\nHuman: ${humanScore} Points\nComputer: ${computerScore} Points\n${message}`);
}
// init start
playGame();