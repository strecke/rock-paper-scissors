function getComputerChoice() {
    return ['r', 'p', 's'][Math.floor(Math.random() * 3)];
}

function getHumanChoice(){
    const choice = prompt('Choose rock: r, paper: p, scissors: s').toLowerCase();
    if (choice.length !== 1 || !/^[rps]$/.test(choice)) return;
    return choice;
}

let humanScore = 0;
let computerScore = 0;

const BEATS = { r: 's', p: 'r', s: 'p', };
const NAMES = { r: 'Rock', p: 'Paper', s: 'Scissors', };

function playRound(humanChoice, computerChoice) {
    if (humanChoice === undefined) return;
    let message;
    if (humanChoice === computerChoice) {
        message = `Tie! ${NAMES[humanChoice]} equals ${NAMES[computerChoice]}`
    } else {
        const isHumanWinner = BEATS[humanChoice] === computerChoice;
        message = isHumanWinner
        ? `You Win! ${NAMES[humanChoice]} beats ${NAMES[computerChoice]}`
        : `You Lose! ${NAMES[computerChoice]} beats ${NAMES[humanChoice]}`;
    }
    
    console.log(message);
}

const humanSelection = getHumanChoice();
const computerSelection = getComputerChoice();

playRound(humanSelection, computerSelection);