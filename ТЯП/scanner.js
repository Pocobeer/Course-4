let isLexAnalysisCompleted = false
let isErrorFound = false

let buffer = ''
let tokenList = []
let f = 0 // позиция первого символа лексемы
let r = 0 // перемещается в процессе распознавания

// КЛЮЧЕВЫЕ СЛОВА
const keywords = [
    { lex: 'begin',   name: 'begin'   }, // Код: 1
    { lex: 'end',     name: 'end'     }, // Код: 2
    { lex: 'repeat',  name: 'repeat'  }, // Код: 3
    { lex: 'until',   name: 'until'   }, // Код: 4
    { lex: 'struct',  name: 'struct'  }, // Код: 5
    { lex: 'true',    name: 'true'    }, // Код: 6
    { lex: 'false',   name: 'false'   }, // Код: 7
]

// Исправленная таблица переходов (добавляем 2 новых столбца для состояний 20 и 21)
const TP = [
    // 0    1    2    3    4    5    6    7    8    9   10   11   12   13   14   15   16   17   18   19   20   21
    [ -1, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], //  0 ;
    [ -2, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], //  1 ,
    [ -3, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], //  2 :
    [ -4, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11,  14, -94, -27, -95, -94, -28,  19, -90, -90], //  3 .
    [ -5, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], //  4 (
    [ -6, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], //  5 )
    [ -7, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], //  6 {
    [ -8, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], //  7 }
    [ -9, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27,  17, -94, -28,  19, -90, -90], //  8 +
    [-10, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27,  17, -94, -28,  19, -90, -90], //  9 -
    [  1, -11, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 10 |
    [-12, -91, -92, -16, -18, -93, -22, -23, -24,  11,  10,  12,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 11 *
    [  9, -91, -92, -16, -18, -93, -22, -23, -24,  10,  10,  11, -25, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 12 /
    [-14, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 13 %
    [  2, -91, -15, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 14 &
    [  3, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 15 <
    [  4, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 16 >
    [-98, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 17 ! 
    [  6, -91, -92, -17, -19, -20, -21, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 18 =
    [  7, -91, -92, -16, -18, -93, -22,   7, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 19 l буква
    [ 13, -91, -92, -16, -18, -93, -22,   7, -24, -13,  10,  11,  11,  13,  15,  15,  18,  18,  18,  19, -90, -90], // 20 d цифра 
    [  8, -91, -92, -16, -18, -93, -22, -23,   8, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 21 space
    [  8, -91, -92, -16, -18, -93, -22, -23,   8, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 22 tab
    [  8, -91, -92, -16, -18, -93, -22, -23,   8, -13, -25,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 23 line feed
    [ 19, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28, -29, -90, -90], // 24 "
    // НОВЫЕ СТРОКИ ДЛЯ [ и ]:
    [-96, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 25 [
    [-97, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 26 ]
    [-90, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10,  11,  11, -26, -94, -27, -95, -94, -28,  19, -90, -90], // 27 другие символы
]

const lexErrorCodes = new Map([
    [-90, 'Лексема не может начинаться с данного символа'],
    [-91, 'Ожидается символ "|"'],
    [-92, 'Ожидается символ "&"'],
    [-93, 'Ожидается символ "="'],
    [-94, 'Ожидается число'],
    [-95, 'Ожидается число, "+" или "-"'],
])

// Таблица соответствий конечного состояния и лексемы
const stateAndToken = [
    { state: -1,  code: 10, attr: 0, name: ';',   ret: 0 },
    { state: -2,  code: 11, attr: 0, name: ',',   ret: 0 },
    { state: -3,  code: 12, attr: 0, name: ':',   ret: 0 },
    { state: -4,  code: 13, attr: 0, name: '.',   ret: 0 },
    { state: -5,  code: 14, attr: 0, name: '(',   ret: 0 },
    { state: -6,  code: 15, attr: 0, name: ')',   ret: 0 },
    { state: -7,  code: 16, attr: 0, name: '{',   ret: 0 },
    { state: -8,  code: 17, attr: 0, name: '}',   ret: 0 },
    { state: -96, code: 49, attr: 0, name: '[',   ret: 0 }, // [
    { state: -97, code: 50, attr: 0, name: ']',   ret: 0 }, // ]
    { state: -9,  code: 18, attr: 0, name: 'add', ret: 0 }, // +
    { state: -10, code: 18, attr: 1, name: 'add', ret: 0 }, // -
    { state: -11, code: 18, attr: 2, name: 'add', ret: 0 }, // ||
    { state: -12, code: 19, attr: 0, name: 'mul', ret: 0 }, // *
    { state: -13, code: 19, attr: 1, name: 'mul', ret: 1 }, // /
    { state: -14, code: 19, attr: 2, name: 'mul', ret: 0 }, // %
    { state: -15, code: 19, attr: 3, name: 'mul', ret: 0 }, // &&
    { state: -16, code: 20, attr: 0, name: 'rel', ret: 1 }, // <
    { state: -17, code: 20, attr: 1, name: 'rel', ret: 0 }, // <=
    { state: -18, code: 20, attr: 2, name: 'rel', ret: 1 }, // >
    { state: -19, code: 20, attr: 3, name: 'rel', ret: 0 }, // >=
    { state: -20, code: 20, attr: 4, name: 'rel', ret: 0 }, // !=
    { state: -21, code: 20, attr: 5, name: 'rel', ret: 0 }, // ==
    { state: -22, code: 9,  attr: 0, name: '=',   ret: 1 }, // =
    { state: -23, code: 21, attr: 0, name: 'id',  ret: 1 }, // идентиф.
    { state: -24, code: 24, attr: 0, name: 'sp',  ret: 1 }, // пробел
    { state: -25, code: 25, attr: 0, name: 'com', ret: 0 }, // комментарий
    { state: -26, code: 22, attr: 0, name: 'num', ret: 1 }, // цел. число
    { state: -27, code: 22, attr: 1, name: 'num', ret: 1 }, // вещ. число
    { state: -28, code: 22, attr: 2, name: 'num', ret: 1 }, // вещ. число c e
    { state: -29, code: 23, attr: 0, name: 'str', ret: 0 }, // строка "
    { state: -98, code: 42, attr: 0, name: '!',   ret: 0 }, // одиночный !
]

// Номер строки в таблице переходов для символа
function getTPLineNum(symbol) {
    if (/^[a-zA-Z]$/.test(symbol)) return 19
    else if (/^[0-9]$/.test(symbol)) return 20
    else return {
        ';': 0,
        ',': 1,
        ':': 2, 
        '.': 3,
        '(': 4,
        ')': 5,
        '{': 6,
        '}': 7,
        '+': 8,
        '-': 9,
        '|': 10,
        '*': 11,
        '/': 12,
        '%': 13,
        '&': 14,
        '<': 15,
        '>': 16,
        '!': 17,
        '=': 18,
        ' ': 21,
        '\t': 22,
        '\r': 23,
        '\n': 23,
        '"': 24,
        '[': 25,  // новая строка для [
        ']': 26   // новая строка для ]
    }[symbol] ?? 27
}

function scanner(buffer) {
    console.log('=== SCANNER START ===');
    console.log('Start position f:', f);

    // Проверка на конец файла
    if (f >= buffer.length) {
        console.log('SCANNER: End of file reached');
        isLexAnalysisCompleted = true;
        return {
            posStart: f,
            code: 0,
            attr: 0,
            name: 'EOF',
            lex: ''
        };
    }

    let state = 0
    r = f

    let step = 0;
    const MAX_STEPS = 1000;

    while (true) {
        step++;
        if (step > MAX_STEPS) {
            console.error('SCANNER: Infinite loop detected!');
            isLexAnalysisCompleted = true;
            isErrorFound = true;
            return;
        }

        // пока не конечное состояние
        while (state >= 0) {
            if (r >= buffer.length) {
                console.log('SCANNER: Reached end of buffer during scanning');
                
                // Если мы в состоянии распознавания идентификатора или числа,
                // попробуем завершить лексему
                if (state === 7 || state === 13 || state === 15) {
                    console.log('Attempting to complete lexeme at EOF');
                    // Переходим в соответствующее конечное состояние
                    if (state === 7) state = -23; // идентификатор
                    else if (state === 13 || state === 15) state = -26; // число
                    break;
                } else {
                    printErrorWithPos(
                        'Незавершенная лексема в конце файла',
                        r, buffer
                    )
                    isLexAnalysisCompleted = true;
                    isErrorFound = true;
                    return;
                }
            }

            let TPRowNum = (
                (state === 13 || state === 15)
                && buffer[r] === 'e'
            )
                ? 25
                : getTPLineNum(buffer[r])

            console.log(`Step ${step}: state=${state}, r=${r}, symbol='${buffer[r]}', TPRowNum=${TPRowNum}`);

            state = TP[TPRowNum][state]
            console.log(`  New state: ${state}`);

            if (state >= 0) r++
        }

        console.log(`Final state reached: ${state}`);

        if (state == -24) {
            f = r
            state = 0
            console.log('Skipping whitespace, new f:', f);
        }
        else if (state == -25) {
            f = r
            r = f + 1
            state = 0
            console.log('Skipping comment, new f:', f);
        }
        else break
    }

    // Проверяем, не вышли ли за границы буфера
    if (f >= buffer.length) {
        console.log('SCANNER: Position f beyond buffer after processing');
        isLexAnalysisCompleted = true;
        return {
            posStart: f,
            code: 0,
            attr: 0,
            name: 'EOF',
            lex: ''
        };
    }

    let token = {}
    let lexeme
    let strNum
    let foundToken

    console.log(`Processing state: ${state}, f=${f}, r=${r}`);

    switch (state) {
        // -1..-22
        case /^-(1?[0-9]|20|21|22)$/.test(state) && state:
            foundToken = stateAndToken.find(obj => obj.state === state)
            token.posStart = f
            token.code = foundToken.code
            token.attr = foundToken.attr
            token.name = foundToken.name
            token.lex = buffer[f]
            f = r + 1 - foundToken.ret
            r -= foundToken.ret
            console.log(`Single char token: ${token.name}, lex: '${token.lex}'`);
            break

        // КЛЮЧЕВОЕ СЛОВО ИЛИ ИДЕНТИФИКАТОР
        case -23:
            // Защита от выхода за границы при создании лексемы
            const endPos = Math.min(r, buffer.length);
            lexeme = buffer.slice(f, endPos).join('')
            strNum = keywords.findIndex(obj => obj.lex === lexeme)
            token.posStart = f

            if (strNum != -1) {
                token.code = strNum + 1
                token.attr = 0
                token.name = keywords[strNum].name
                console.log(`Keyword: ${token.name}`);
                
                if (token.code === 2) // end
                    isLexAnalysisCompleted = true
            }
            else {
                foundToken = stateAndToken.find(obj => obj.state === state)
                token.code = foundToken.code
                token.attr = 0
                token.name = foundToken.name
                token.lex = lexeme
                console.log(`Identifier: ${lexeme}`);
            }

            f = Math.min(r, buffer.length)
            break

        // числа
        case -26:
        case -27:
        case -28:
            const numEndPos = Math.min(r, buffer.length);
            lexeme = + buffer.slice(f, numEndPos).join('')
            foundToken = stateAndToken.find(obj => obj.state === state)
            token.posStart = f
            token.code = foundToken.code
            token.attr = foundToken.attr
            token.name = foundToken.name
            token.lex = lexeme
            f = Math.min(r, buffer.length)
            console.log(`Number: ${lexeme}, type: ${token.name}`);
            break

        // строка
        case -29:
            const strEndPos = Math.min(r, buffer.length);
            lexeme = buffer.slice(f + 1, strEndPos).join('')
            foundToken = stateAndToken.find(obj => obj.state === state)
            token.posStart = f
            token.code = foundToken.code
            token.name = foundToken.name
            token.lex = lexeme
            f = Math.min(r + 1, buffer.length)
            console.log(`String: "${lexeme}"`);
            break

        // НОВЫЕ СЛУЧАИ ДЛЯ МАССИВОВ
        case -96:
        case -97:
            foundToken = stateAndToken.find(obj => obj.state === state)
            token.posStart = f
            token.code = foundToken.code
            token.attr = foundToken.attr
            token.name = foundToken.name
            token.lex = buffer[f]
            f = r + 1 - foundToken.ret
            r -= foundToken.ret
            console.log(`Array token: ${token.name}, lex: '${token.lex}'`);
            break
        case -98:
            foundToken = stateAndToken.find(obj => obj.state === state)
            token.posStart = f
            token.code = foundToken.code
            token.attr = foundToken.attr
            token.name = foundToken.name
            token.lex = buffer[f]
            f = r + 1 - foundToken.ret
            r -= foundToken.ret
            console.log(`Operator: ${token.name}, lex: '${token.lex}'`);
            break
            
        case -90:
        case -91:
        case -92:
        case -93:
        case -94:
        case -95:
            console.error(`Lex error: ${state} - ${lexErrorCodes.get(state)}`);
            printErrorWithPos(
                `Обнаружена лексическая ошибка!\n`
                + state + ': ' + lexErrorCodes.get(state), r, buffer
            )
            isLexAnalysisCompleted = true
            isErrorFound = true
            return

        default:
            console.error(`Unknown state: ${state}`);
            printErrorWithPos(
                `Неизвестное состояние автомата: ${state}`, r, buffer
            )
            isLexAnalysisCompleted = true
            isErrorFound = true
            return
    }

    console.log('=== SCANNER END === Token:', token);
    return token
}

function printErrorWithPos(body, pos, buffer) {
    let coord = coordsByIndex(pos, buffer)
    let line = leftEditor.getLine(coord.line - 1)

    // формируем строку, указывающую позицию ошибки в строке
    let errorIndicator = ''
    for (let i = 0; i < line.length; i++) {
        if (i === coord.ch - 1)
            errorIndicator += '^'
        else if (line[i] === '\t')
            errorIndicator += '\t'
        else
            errorIndicator += ' '
    }
    
    drawMiddleEditor('Ошибка', `Строка: ${coord.line}, cтолбец: ${coord.ch}\n${line}\n${errorIndicator}\n${body}`)
    isLexAnalysisCompleted = true
    isErrorFound = true
}

function getTokenListAsText() {
    const nameMaxLength = Math.max(...tokenList.map(t => t.name.length))
    return tokenList.map(token => {
        let name = `${token.name},`.padEnd(nameMaxLength + 1)
        let attr = token.attr ? token.attr.toString().padStart(2) : ' '.padStart(2)
        let lex = token.lex
        return `<${name} ${attr}>${lex}`
    }
    ).join('\n')
}

function getTokenList() {
    return tokenList.map(token => [ token.name, token.lex ])
}

function fillTokenList(text) {
    console.log('=== FILL TOKEN LIST START ===');
    
    isLexAnalysisCompleted = false
    isErrorFound = false
    tokenList = []
    f = r = 0

    buffer = text.split('')
    console.log('Buffer length:', buffer.length);

    let iteration = 0;
    const MAX_ITERATIONS = 200;

    while (!isLexAnalysisCompleted && !isErrorFound && iteration < MAX_ITERATIONS) {
        iteration++;
        console.log(`\n--- Token iteration ${iteration} ---`);
        let token = scanner(buffer)
        if (token) {
            if (token.code === 0) { // EOF токен
                isLexAnalysisCompleted = true;
            } else {
                tokenList.push(token)
            }
        } else {
            isLexAnalysisCompleted = true;
        }
    }

    if (iteration >= MAX_ITERATIONS) {
        console.error('Too many token iterations! Possible infinite loop.');
        drawMiddleEditor('Ошибка', 'Лексический анализ: возможен бесконечный цикл');
        isErrorFound = true;
    }

    console.log('=== FILL TOKEN LIST END === Total tokens:', tokenList.length);
}