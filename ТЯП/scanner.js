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
    { lex: 'if',      name: 'if'      }, // Код: 3
    { lex: 'then',    name: 'then'    }, // Код: 4
    { lex: 'else',    name: 'else'    }, // Код: 5
    { lex: 'class',   name: 'class'  }, // Код: 6
    { lex: 'true',    name: 'true'    }, // Код: 7
    { lex: 'false',   name: 'false'   }, // Код: 8
]

// Таблица переходов
const TP = [
    // 0    1    2    3    4    5    6    7    8    9   10  11   12   13   14   15   16   17   18   19  
    [ -1, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], //  0 ;
    [ -2, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], //  1 ,
    [ -3, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], //  2 :
    [ -4, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11,  14, -94, -27, -95, -94, -28,  19], //  3 .
    [ -5, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], //  4 (
    [ -6, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], //  5 )
    [ -7, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], //  6 {
    [ -8, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], //  7 }
    [ -9, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27,  17, -94, -28,  19], //  8 +
    [-10, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27,  17, -94, -28,  19], //  9 -
    [  1, -11, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], // 10 |
    [-12, -91, -92, -16, -18, -93, -22, -23, -24,  11,  10, 12,  11, -26, -94, -27, -95, -94, -28,  19], // 11 *
    [  9, -91, -92, -16, -18, -93, -22, -23, -24,  10,  10, 11, -25, -26, -94, -27, -95, -94, -28,  19], // 12 /
    [-14, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], // 13 %
    [  2, -91, -15, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], // 14 &
    [  3, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], // 15 <
    [  4, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], // 16 >
    [  5, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], // 17 !
    [  6, -91, -92, -17, -19, -20, -21, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], // 18 =
    [  7, -91, -92, -16, -18, -93, -22,   7, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], // 19 l буква
    [ 13, -91, -92, -16, -18, -93, -22,   7, -24, -13,  10, 11,  11,  13,  15,  15,  18,  18,  18,  19], // 20 d цифра 
    [  8, -91, -92, -16, -18, -93, -22, -23,   8, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], // 21 space
    [  8, -91, -92, -16, -18, -93, -22, -23,   8, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], // 22 tab
    [  8, -91, -92, -16, -18, -93, -22, -23,   8, -13, -25, 11,  11, -26, -94, -27, -95, -94, -28,  19], // 23 line feed
    [ 19, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28, -29], // 24 "
    [  7, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11,  16, -94,  16, -95, -94, -28,  19], // 25 e
    [-90, -91, -92, -16, -18, -93, -22, -23, -24, -13,  10, 11,  11, -26, -94, -27, -95, -94, -28,  19], // 26 другие символы
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
        '"': 24
    }[symbol] ?? 26
}

function scanner(buffer) {

    let state = 0 // начальное состояние автомата
    r = f // первый символ лексемы

    while (true) {

        // пока не конечное состояние
        while (state >= 0) {

            // номер строки табл. переходов (+ проверяется на экспоненту)
            let TPRowNum = (
                (state === 13 || state === 15)
                && buffer[r] === 'e'
            )
                ? 25
                : getTPLineNum(buffer[r])

            // следующее состояние
            state = TP[TPRowNum][state]

            if (state >= 0) r++ // следующий входной символ
        }
        // отработаны пробелы и т.п.
        if (state == -24) {
            f = r // 1-ый символ след. лексемы с учетом возврата одного символа
            state = 0
        }
        //отработаны комментарии
        else if (state == -25) {
            f = r // 1-ый символ след. лексемы с учетом возврата одного символа
            r = f + 1
            state = 0
        }
        else break
    }

    let token = {}
    let lexeme
    let strNum
    let foundToken

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
            break

        // КЛЮЧЕВОЕ СЛОВО ИЛИ ИДЕНТИФИКАТОР
        case -23:
            lexeme = buffer.slice(f, r).join('')
            strNum = keywords.findIndex(obj => obj.lex === lexeme)
            token.posStart = f

            // КЛЮЧЕВОЕ СЛОВО
            if (strNum != -1) {
                token.code = strNum + 1
                token.attr = 0
                token.name = keywords[strNum].name

                if (token.code === 2) // end
                    isLexAnalysisCompleted = true

            }

            // ИДЕНТИФИКАТОР
            else {
                foundToken = stateAndToken.find(obj => obj.state === state)
                token.code = foundToken.code
                token.attr = 0
                token.name = foundToken.name
                token.lex = lexeme
            }

            f = r // возврат = 1, начало след. лексемы

            break

        // числа
        case -26:
        case -27:
        case -28:
            lexeme = + buffer.slice(f, r).join('')
            foundToken = stateAndToken.find(obj => obj.state === state)
            token.posStart = f
            token.code = foundToken.code
            token.attr = foundToken.attr
            token.name = foundToken.name
            token.lex = lexeme
            f = r // возврат = 1, начало след. лексемы
            break

        // строка
        case -29:
            lexeme = buffer.slice(f + 1, r).join('')
            foundToken = stateAndToken.find(obj => obj.state === state)
            token.posStart = f
            token.code = foundToken.code
            token.name = foundToken.name
            token.lex = lexeme
            f = r + 1 // следующая лексема
            break

        case -90:
        case -91:
        case -92:
        case -93:
        case -94:
        case -95:
            printErrorWithPos(
                `Обнаружена лексическая ошибка!\n`
                + state + ': ' + lexErrorCodes.get(state), r, buffer
            )
            isLexAnalysisCompleted = true
            isErrorFound = true
            return
    }

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
    return tokenList.map(token => {
        return [
            token.name,
            token.lex
        ]
    })
}

function fillTokenList(text) {
    isLexAnalysisCompleted = false
    isErrorFound = false
    tokenList = []
    f = r = 0

    buffer = text.split('')

    while (!isLexAnalysisCompleted) {
        tokenList.push(scanner(buffer))
    }
}
