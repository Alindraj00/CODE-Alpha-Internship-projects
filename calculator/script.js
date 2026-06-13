const currentDisplay = document.getElementById('current-operand');
const previousDisplay = document.getElementById('previous-operand');

let currentInput = '0';
let previousInput = '';
let operation = null;
let shouldResetDisplay = false;

function updateDisplay() {
    currentDisplay.innerText = currentInput;
    if (operation != null) {
        let displayOp = operation === '*' ? '×' : operation === '/' ? '÷' : operation;
        previousDisplay.innerText = `${previousInput} ${displayOp}`;
    } else {
        previousDisplay.innerText = '';
    }
}

function appendNumber(number) {
    if (currentInput === '0' && number !== '.') {
        currentInput = number;
    } else if (shouldResetDisplay) {
        currentInput = number;
        shouldResetDisplay = false;
    } else {
        if (number === '.' && currentInput.includes('.')) return; // Prevent double decimals
        currentInput += number;
    }
    updateDisplay();
}

function appendOperator(op) {
    if (operation !== null && !shouldResetDisplay) {
        calculate();
    }
    operation = op;
    previousInput = currentInput;
    shouldResetDisplay = true;
    updateDisplay();
}

function calculate() {
    if (operation === null || shouldResetDisplay) return;
    
    let result;
    const prev = parseFloat(previousInput);
    const current = parseFloat(currentInput);

    if (isNaN(prev) || isNaN(current)) return;

    switch (operation) {
        case '+':
            result = prev + current;
            break;
        case '-':
            result = prev - current;
            break;
        case '*':
            result = prev * current;
            break;
        case '/':
            if (current === 0) {
                alert("Cannot divide by zero!");
                clearScreen();
                return;
            }
            result = prev / current;
            break;
        default:
            return;
    }

    // Rounding off to fix floating-point math issues (e.g., 0.1 + 0.2)
    currentInput = Math.round(result * 1e10) / 1e10;
    currentInput = currentInput.toString();
    operation = null;
    previousInput = '';
    shouldResetDisplay = true;
    updateDisplay();
}

function clearScreen() {
    currentInput = '0';
    previousInput = '';
    operation = null;
    shouldResetDisplay = false;
    updateDisplay();
}

function deleteNumber() {
    if (shouldResetDisplay) return;
    if (currentInput.length === 1 || currentInput === '0') {
        currentInput = '0';
    } else {
        currentInput = currentInput.slice(0, -1);
    }
    updateDisplay();
}

// --- BONUS: Keyboard Support Implementation ---
window.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9' || e.key === '.') {
        appendNumber(e.key);
    } else if (e.key === '+' || e.key === '-') {
        appendOperator(e.key);
    } else if (e.key === '*') {
        appendOperator('*');
    } else if (e.key === '/') {
        e.preventDefault(); // Prevents quick find search in some browsers
        appendOperator('/');
    } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        calculate();
    } else if (e.key === 'Backspace') {
        deleteNumber();
    } else if (e.key === 'Escape') {
        clearScreen();
    }
});