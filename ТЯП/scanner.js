// scanner.js

let isLexAnalysisCompleted = false;
let isErrorFound = false;

// Глобальная переменная buffer, которая будет установлена в fillTokenList
let buffer = [];
let tokenList = [];
let f = 0; // позиция первого символа лексемы
let r = 0; // перемещается в процессе распознавания

// КЛЮЧЕВЫЕ СЛОВА MyLang (с кодами токенов, соответствующими РГР/SLR-таблице)
// Имена токенов должны соответствовать именам в SLR-таблице (xmlString)
const keywords = [
    { lex: 'prog', name: 'prog', code: 27 },
    { lex: 'endProg', name: 'eof', code: 28 },
    { lex: 'var',     name: 'var', code: 29 },
    { lex: 'start',   name: 'start', code: 30 },
    { lex: 'stop',    name: 'stop', code: 31 },
    { lex: 'if',      name: 'if', code: 32 },
    { lex: 'then',    name: 'then', code: 33 },
    { lex: 'else',    name: 'else', code: 34 },
    { lex: 'repeat',  name: 'repeat', code: 35 },
    { lex: 'until',   name: 'until', code: 36 },
    { lex: 'integer', name: 'integer', code: 37 },
    { lex: 'real',    name: 'real', code: 38 },
    { lex: 'string',  name: 'string', code: 39 },
    { lex: 'bool',    name: 'bool', code: 40 },
    { lex: 'array',   name: 'array', code: 41 },
    { lex: 'True',    name: 'bool_literal', code: 46, attr: 1 },
    { lex: 'False',   name: 'bool_literal', code: 47, attr: 0 },
];

// Таблица переходов для MyLang
// Порядок: TP[состояние][символ/номер_строки_в_таблице]
// Символы: 0-';', 1-',', 2-':', 3-'.', 4-'(', 5-')', 6-'[', 7-']', 8-'+', 9-'-', 10-'<', 11-'>', 12-'=', 13-'!', 14-'|', 15-'&', 16-' ', 17-'\t', 18-'\r', 19-'\n', 20-'0-9', 21-'a-zA-Z_', 22-'/', 23-'"', 24-'другие'
const TP = [
    // Состояние 0: начальное
    [ -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, 10, 11, -21, 13, 14, 15,  0,  0,  0,  0,  2,  1, 25,  8, -90], // 0
    // Состояния 1-15: идентификатор, числа, строка, отношения, логика
    [-28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28,  1,  1, -28, -28, -30], // 1: идентификатор
    [-22, -22, -22,  3,  3,  5,  5,  7, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22,  2, -22, -22, -22, -30], // 2: целое
    [-23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23,  4, -23, -23, -23, -30], // 3: точка
    [-23, -23, -23, -23, -23,  5,  5,  7, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23,  4, -23, -23, -23, -30], // 4: дробь
    [-24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24,  6, -24, -24, -24, -30], // 5: 'e'
    [-24, -24, -24, -24, -24, -24, -24, -24, -24,  6, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24,  7, -24, -24, -24, -30], // 6: '+'/'-'
    [-24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24,  7, -24, -24, -24, -30], // 7: цифра после e
    [  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9, -96,  9,  9,  9, -25,  9], // 8: открывающая кавычка
    [  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9,  9, -96,  9,  9,  9, -25,  9], // 9: внутри строки
    // Состояния 16-21: отношения и логика (для примера, могут быть не все)
    [-15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, 17, 16, -15, -15, -15, -15, -15, -15, -15, -15, -15, -30], // 10: < (-> <=)
    [-17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, 18, -17, -17, -17, -17, -17, -17, -17, -17, -17, -30], // 11: > (-> >=)
    [-21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -30], // 12: = (-> ==)
    [-19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, 20, -19, -19, -19, -19, -19, -19, -19, -19, -19, -30], // 13: ! (-> !=)
    [-11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, 23, -11, -11, -11, -11, -11, -11, -11, -30], // 14: | (-> ||)
    [-14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, 24, -14, -14, -14, -14, -14, -14, -30], // 15: & (-> &&)
    // Состояния 22-24: для комментариев и логических операций (расширяем TP)
    [ -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1,  -1, 25,  -1,  -1], // 16: '/' (ожидаем второй / или * или -> ошибка)
    [ -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -30], // 17: ||
    [ -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -30], // 18: &&
    // Добавим состояние для начала комментария //
    [-13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, 26, -13, -13], // 19: внутри комментария // (возврат в 0)
    // Заполняем недостающие строки, чтобы индексировать до 25
    [-31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31,  0, -31, -31, -31, -31, -30], // 20
    [-31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31,  0, -31, -31, -31, -31, -30], // 21
    [-31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31,  0, -31, -31, -31, -31, -30], // 22
    [-31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31,  0, -31, -31, -31, -31, -30], // 23
    [-31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31,  0, -31, -31, -31, -31, -30], // 24
    [  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0], // 25: '/' -> ожидаем '/'
];

// Убедимся, что TP имеет 26 строк (0-25), чтобы индексировать до state 25
while (TP.length < 26) {
    // Заполняем новую строку значением -90 (ошибка)
    TP.push(Array(25).fill(-90));
}
// Исправим состояние 25: '/' ожидает '/'
TP[25] = Array(25).fill(-90);
TP[25][22] = 19; // '/' -> '/' -> состояние 19 (внутри комментария)

// Убедимся, что каждая строка TP имеет 25 столбцов.
for (let i = 0; i < TP.length; i++) {
    if (TP[i].length < 25) {
        while (TP[i].length < 25) {
            TP[i].push(-90);
        }
    }
}


const lexErrorCodes = new Map([
    [-90, 'Лексема не может начинаться с данного символа'],
    [-91, 'Ожидается символ "=" после ">"'],
    [-92, 'Ожидается символ "=" после "<"'],
    [-93, 'Ожидается символ "=" после "!"'],
    [-94, 'Ожидается цифра после "e" или "E"'],
    [-95, 'Ожидается "+" или "-" после "e" или "E"'],
    [-96, 'Незакрытая строка'],
    [-97, 'Незакрытый комментарий'],
]);

// Таблица соответствий конечного состояния и лексемы для MyLang
// Коды: 1-10 (разделители), 11-20 (операции), 21-26 (константы), 27+ (ключевые слова и др.)
// Имена должны соответствовать именам в SLR-таблице (xmlString)
const stateAndToken = [
    { state: -1,  code: 10, name: ';',           ret: 0 },
    { state: -2,  code: 11, name: ',',           ret: 0 },
    { state: -3,  code: 12, name: ':',           ret: 0 },
    { state: -4,  code: 13, name: '.',           ret: 0 },
    { state: -5,  code: 14, name: '(',           ret: 0 },
    { state: -6,  code: 15, name: ')',           ret: 0 },
    { state: -7,  code: 42, name: '[',           ret: 0 },
    { state: -8,  code: 43, name: ']',           ret: 0 },
    { state: -9,  code: 16, name: 'add',         ret: 0, attr: 0 }, // +
    { state: -10, code: 16, name: 'add',         ret: 0, attr: 1 }, // -
    { state: -11, code: 16, name: 'add',         ret: 1, attr: 2 }, // ||
    { state: -12, code: 17, name: 'mul',         ret: 0, attr: 0 }, // *
    { state: -13, code: 17, name: 'mul',         ret: 1, attr: 1 }, // /
    { state: -14, code: 17, name: 'mul',         ret: 0, attr: 2 }, // &&
    { state: -15, code: 18, name: 'rel',         ret: 1, attr: 0 }, // < (0)
    { state: -16, code: 18, name: 'rel',         ret: 0, attr: 1 }, // <= (1)
    { state: -17, code: 18, name: 'rel',         ret: 1, attr: 2 }, // > (2)
    { state: -18, code: 18, name: 'rel',         ret: 0, attr: 3 }, // >= (3)
    { state: -19, code: 18, name: 'rel',         ret: 0, attr: 4 }, // != (4)
    { state: -20, code: 18, name: 'rel',         ret: 0, attr: 5 }, // == (5)
    { state: -21, code: 19, name: 'assign',      ret: 1 }, // =
    { state: -22, code: 21, name: 'num_int',     ret: 1, attr: 0 }, // цел. число
    { state: -23, code: 22, name: 'num_real',    ret: 1, attr: 1 }, // вещ. число (.)
    { state: -24, code: 22, name: 'num_real',    ret: 1, attr: 2 }, // вещ. число (e)
    { state: -25, code: 23, name: 'string_literal', ret: 0 }, // строка
    { state: -26, code: 24, name: 'bool_literal', ret: 0, attr: 0 }, // False
    { state: -27, code: 24, name: 'bool_literal', ret: 0, attr: 1 }, // True
    { state: -28, code: 25, name: 'id',          ret: 1 }, // идентификатор (или ключевое слово)
    { state: -29, code: 26, name: 'ws',          ret: 1 }, // пробелы (обрабатываются внутри scanner)
    { state: -30, code: 0,  name: 'error',       ret: 0 }, // ошибка
    { state: -31, code: 0,  name: 'comment',     ret: 0 }, // комментарий (не генерирует токен)
];

// Номер строки в таблице переходов для символа
function getTPLineNum(symbol) {
    if (/[a-zA-Z_]/.test(symbol)) return 21; // Буквы и _ для идентификаторов
    else if (/[0-9]/.test(symbol)) return 20; // Цифры
    else return {
        ';': 0,
        ',': 1,
        ':': 2,
        '.': 3,
        '(': 4,
        ')': 5,
        '[': 6,
        ']': 7,
        '+': 8,
        '-': 9,
        '<': 10,
        '>': 11,
        '=': 12,
        '!': 13,
        '|': 14,
        '&': 15,
        ' ': 16,
        '\t': 17,
        '\r': 18,
        '\n': 19,
        '/': 22, // Для комментариев
        '"': 23, // Для строк
    }[symbol] ?? 24; // 24 - "другие символы"
}

// Функция scanner теперь использует глобальную переменную buffer
function scanner() {
    console.log("Scanner вызван, f:", f, "r:", r, "buffer.length:", buffer.length); // Отладка
    let state = 0;
    r = f; // r начинает с f

    let lexeme; // Объявляем lexeme здесь
    let foundToken; // --- ИСПРАВЛЕНО: Объявляем foundToken ВНУТРИ scanner, но до цикла ---

    while (true) {
        // --- ПРОВЕРКА ГРАНИЦ БУФЕРА ПЕРЕД ЦИКЛОМ ---
        if (r >= buffer.length) {
        // Конец входного потока
            if (state === 0) { // Если мы в начальном состоянии, возвращаем EOF
                console.log("Scanner: Конец буфера в нач. состоянии, возвращаем EOF"); // Отладка
                const eofToken = { posStart: r, code: 28, name: 'eof', lex: 'eof' };
                isLexAnalysisCompleted = true;
                return eofToken;
            } else {
                // Если мы в середине лексемы, это ошибка
                console.log("Scanner: Ошибка - конец буфера в середине лексемы, r:", r, "state:", state); // Отладка
                printErrorWithPos('Неожиданный конец входного потока', r, buffer);
                return null;
            }
        }

        // --- НОВОЕ: Пропуск пробелов в начальном состоянии ---
        // Проверяем, находимся ли мы в начальном состоянии и читаем пробельный символ
        if (state === 0) {
            let TPRowNum = getTPLineNum(buffer[r]);
            if (TPRowNum === 16 /* ' ' */ || TPRowNum === 17 /* '\t' */ || TPRowNum === 18 /* '\r' */ || TPRowNum === 19 /* '\n' */) {
                console.log("Scanner: Пробел в нач. состоянии, пропускаем, r:", r, "symbol:", buffer[r]); // Отладка
                f++; // Продвигаем оба указателя
                r++;
                continue; // Начинаем цикл заново, не начиная распознавание
            }
        }

        while (state >= 0) {
            // --- ПРОВЕРКА ГРАНИЦ БУФЕРА ВНУТРИ ЦИКЛА ---
            if (r >= buffer.length) {
                 // Конец буфера во время распознавания
                 // Проверим, если текущее состояние - завершающее
                 foundToken = stateAndToken.find(obj => obj.state === state); // --- ИСПРАВЛЕНО: Присваиваем в foundToken ---
                 if (foundToken) {
                     // Токен распознан до конца буфера
                     console.log("Scanner: Токен распознан до конца буфера, state:", state); // Отладка
                     break; // Выйдем из внутреннего цикла, обработаем токен
                 } else {
                     // Конец буфера в середине лексемы
                     if (state === 0) {
                         console.log("Scanner: Конец буфера в нач. состоянии (2), возвращаем EOF"); // Отладка
                         const eofToken = { posStart: r, code: 28, name: 'eof', lex: 'eof' };
                         isLexAnalysisCompleted = true;
                         return eofToken;
                     } else {
                         console.log("Scanner: Ошибка - конец буфера в середине лексемы (2), r:", r, "state:", state); // Отладка
                         printErrorWithPos('Неожиданный конец входного потока', r, buffer);
                         return null;
                     }
                 }
            }

            let TPRowNum = getTPLineNum(buffer[r]);
            console.log("Scanner: Символ:", buffer[r], "r:", r, "TPRowNum:", TPRowNum, "state:", state); // Отладка

            // --- ПРОВЕРКА НА ВАЛИДНОСТЬ ИНДЕКСОВ ---
            if (state < 0 || state >= TP.length) {
                console.error("Scanner: Неверный индекс состояния:", state); // Отладка
                printErrorWithPos(`Неверный индекс состояния: ${state}`, r, buffer);
                isErrorFound = true;
                return null;
            }
            if (TPRowNum < 0 || TPRowNum >= TP[state].length) {
                console.error("Scanner: Неверный индекс символа (строки):", TPRowNum, "для состояния", state); // Отладка
                printErrorWithPos(`Неверный индекс символа (строки): ${TPRowNum} для состояния ${state}`, r, buffer);
                isErrorFound = true;
                return null;
            }
            // --- КОНЕЦ ПРОВЕРКИ ---
            state = TP[state][TPRowNum];
            console.log("Scanner: Новое состояние:", state); // Отладка
            if (state >= 0) r++;
        }

        // Проверка на конечные состояния после выхода из внутреннего цикла
        foundToken = stateAndToken.find(obj => obj.state === state); // --- ИСПРАВЛЕНО: Присваиваем в foundToken ---
        if (foundToken) {
            console.log("Scanner: Найден токен в состоянии:", state, "f:", f, "r:", r); // Отладка
            // --- ИСПРАВЛЕНО: Обновляем f ДО получения lexeme ---
            const current_f = f; // Сохраняем старое f для posStart
            f = r; // Устанавливаем f на r для следующей лексемы
            lexeme = buffer.slice(current_f, r).join(''); // Используем сохранённое f
            console.log("Scanner: Обработка токена, lexeme:", lexeme, "current_f:", current_f, "r:", r); // Отладка

            let token = {};
            token.posStart = current_f; // Используем старое f
            token.code = foundToken.code;
            token.name = foundToken.name; // Временное имя из таблицы
            token.attr = foundToken.attr !== undefined ? foundToken.attr : 0;

            // --- ИСПРАВЛЕНО: Проверяем ключевые слова ДО установки token.lex для 'id' ---
            if (foundToken.name === 'id') { // Если это потенциальный идентификатор
                const keyword = keywords.find(kw => kw.lex.toLowerCase() === lexeme.toLowerCase());
                if (keyword) {
                    // Это ключевое слово
                    token.code = keyword.code; // Используем код из keywords
                    token.name = keyword.name; // Используем имя из keywords (например, 'prog', 'var')
                    token.lex = keyword.lex; // Сохраняем оригинальную форму ключевого слова
                    token.attr = keyword.attr !== undefined ? keyword.attr : 0; // Используем attr из keywords, если есть
                } else {
                    // Это обычный идентификатор
                    token.lex = lexeme; // Для обычных идентификаторов
                }
                // f уже обновлено выше
            } else if (token.name === 'comment') {
                // Пропускаем комментарий
                // f уже обновлено выше
                state = 0; // Возвращаемся в начальное состояние
                continue; // Продолжаем цикл scanner
            } else if (token.name.startsWith('num')) {
                if (token.name === 'num_int') {
                     token.lex = parseInt(lexeme, 10);
                } else {
                     token.lex = parseFloat(lexeme);
                }
                // f уже обновлено выше
            } else if (token.name === 'string_literal') {
                // Убираем кавычки
                token.lex = lexeme.slice(1, -1);
                // f уже обновлено выше
            } else if (token.name === 'bool_literal') {
                // Устанавливаем attr в зависимости от лексемы, если не установлен из keywords
                token.lex = lexeme;
                if (token.attr === undefined) {
                    token.attr = (lexeme.toLowerCase() === 'true') ? 1 : 0;
                }
                // f уже обновлено выше
            } else if (token.name === 'ws') {
                 // Пропускаем пробельные символы - не должно дойти до сюда, если правильно обрабатываются
                 // f уже обновлено выше
                 return scanner(); // Возвращаем результат следующего вызова
            } else {
                // Для остальных терминалов ( ; , : . ( ) [ ] + - * / = < > ! | & )
                token.lex = lexeme;
                // f уже обновлено выше
            }
            console.log("Scanner: Возвращаем токен:", token); // Отладка
            return token; // Возвращаем токен
        }

        // Обработка состояний, не являющихся конечными токенами (например, ошибки, пробелы, комментарии)
        // Пробелы: состояние -29 не генерирует токен, просто пропускаем
        if (state === -29) {
             console.log("Scanner: Пробелы, f:", f, "r:", r); // Отладка
             f = r; // Устанавливаем f на r, чтобы начать следующую лексему без пробелов
             state = 0; // Возвращаемся в начальное состояние
             continue; // Продолжаем цикл scanner
        } else if (state === -90) { // Ошибка начала лексемы (например, '/' без '*' или '*')
             console.log("Scanner: Ошибка в состоянии:", state); // Отладка
             printErrorWithPos(lexErrorCodes.get(state) || `Неизвестная ошибка: ${state}`, r, buffer);
             isErrorFound = true;
             // Попытка восстановиться: пропустить один символ
             f = r + 1;
             r = f;
             state = 0;
             // Продолжаем цикл scanner
             continue;
        } else if (state <= -90) { // Другие коды ошибок
             console.log("Scanner: Неизвестное состояние ошибки:", state); // Отладка
            // Неизвестное состояние или ошибка
            printErrorWithPos(`Неизвестное состояние автомата: ${state}`, r, buffer);
            isErrorFound = true;
            // Попытка восстановиться: пропустить один символ
            f = r + 1;
            r = f;
            state = 0;
            // Продолжаем цикл scanner
            continue;
        } else {
             console.log("Scanner: Неизвестное состояние:", state); // Отладка
            // Неизвестное состояние или ошибка
            printErrorWithPos(`Неизвестное состояние автомата: ${state}`, r, buffer);
            isErrorFound = true;
            // Попытка восстановиться: пропустить один символ
            f = r + 1;
            r = f;
            state = 0;
            // Продолжаем цикл scanner
            continue;
        }
    }
}


function printErrorWithPos(body, pos, buffer) {
    console.error("printErrorWithPos вызван:", body, "pos:", pos); // Отладка
    let coord;
    try {
        coord = coordsByIndex(pos, buffer);
    } catch (e) {
        console.error("Ошибка в coordsByIndex:", e);
        drawMiddleEditor('Ошибка', `Ошибка при определении позиции: ${body}\nИндекс: ${pos}\n${e.message}`);
        isErrorFound = true;
        isLexAnalysisCompleted = true; // Останавливаем анализ
        return;
    }

    let line;
    try {
        line = leftEditor.getLine(coord.line - 1);
    } catch (e) {
        console.error("Ошибка получения строки из редактора:", e);
        line = `Строка ${coord.line} (не найдена в редакторе)`;
    }

    // формируем строку, указывающая позицию ошибки в строке
    let errorIndicator = '';
    for (let i = 0; i < line.length; i++) {
        if (i === coord.ch - 1)
            errorIndicator += '^';
        else if (line[i] === '\t')
            errorIndicator += '\t';
        else
            errorIndicator += ' ';
    }

    drawMiddleEditor('Ошибка', `Строка: ${coord.line}, cтолбец: ${coord.ch}\n${line}\n${errorIndicator}\n${body}`);
    isErrorFound = true;
}

function getTokenListAsText() {
    const nameMaxLength = Math.max(...tokenList.map(t => t.name.length));
    return tokenList.map(token => {
        let name = `${token.name},`.padEnd(nameMaxLength + 1);
        let attr = token.attr !== undefined ? token.attr.toString().padStart(2) : ' '.padStart(2);
        let lex = token.lex;
        return `<${name} ${attr}>${lex}`;
    }).join('\n');
}

function getTokenList() {
    return tokenList.map(token => {
        return [
            token.name,
            token.lex
        ];
    });
}

function fillTokenList(text) {
    console.log("fillTokenList вызван, text:", text); // Отладка
    isLexAnalysisCompleted = false;
    isErrorFound = false;
    tokenList = [];
    f = r = 0;

    // Устанавливаем глобальную переменную buffer как МАССИВ
    buffer = text.split('');
    console.log("fillTokenList: buffer после split:", buffer); // Отладка

    // Проверка на пустой текст
    if (buffer.length === 0) {
        console.log("fillTokenList: Входной текст пуст, устанавливаем EOF"); // Отладка
        // isLexAnalysisCompleted = true; // Уже будет установлен scanner'ом при первом вызове
        const eofToken = scanner(); // Вызываем scanner, он должен вернуть EOF
        if (eofToken) {
            tokenList.push(eofToken);
            console.log("fillTokenList: Добавлен EOF токен для пустого текста"); // Отладка
        }
        return;
    }

    let iterationCount = 0; // Защита от бесконечного цикла
    const maxIterations = buffer.length * 2; // Установим лимит, например, двойная длина буфера

    while (!isLexAnalysisCompleted && !isErrorFound && iterationCount < maxIterations) { // Добавлен флаг isErrorFound и защита от бесконечного цикла
        console.log("fillTokenList: Цикл, итерация:", iterationCount, "f:", f, "r:", r, "isLexCompleted:", isLexAnalysisCompleted, "isErrorFound:", isErrorFound); // Отладка
        const token = scanner();
        console.log("fillTokenList: Получен токен из scanner:", token); // Отладка
        if (token) {
            tokenList.push(token);
            console.log("fillTokenList: Добавлен токен в tokenList, длина:", tokenList.length); // Отладка
        } else {
            console.log("fillTokenList: scanner вернул null/undefined, выходим из цикла"); // Отладка
            // Ошибка, выходим из цикла
            break;
        }
        iterationCount++;
    }

    if (iterationCount >= maxIterations) {
        console.error("fillTokenList: Превышено максимальное количество итераций, возможен бесконечный цикл."); // Отладка
        isErrorFound = true;
        drawMiddleEditor('Ошибка', 'Превышено максимальное количество итераций в лексическом анализе.');
    }

    console.log("fillTokenList: Завершено, tokenList:", tokenList); // Отладка
}
