const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchDiceRoll = async () => {
    await delay(500); // 500ms для реализма
    const playerRoll = Math.floor(Math.random() * 6) + 1;
    const opponentRoll = Math.floor(Math.random() * 6) + 1;
    return { playerRoll, opponentRoll };
};