function getComputerChoice() {
    return ['r', 'p', 's'][Math.floor(Math.random() * 3)];
}

function getHumanChoice(){
    const choice = prompt('Choose rock: r, paper: p, scissors: s').toLowerCase();
    if (choice.length !== 1 || !/^[rps]$/.test(choice)) return;
    return choice;
}
