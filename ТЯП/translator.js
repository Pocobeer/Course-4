// translator.js

// --- Удалено определение Types ---
// let idents
// let types
// const Types = new Enum('INT', 'FLOAT', 'BOOL', 'STR', 'NONE') // Не используется в РГР

let xml;
let tblSt;
let attrSt;
let instrSt;
let typesSt;
let offsetSt;
let nextlistSt;
let Q = [];

let offset;
let nextAddr;  // адрес очередной свободной ячейки в памяти данных
let nextInstr; // адрес очередной генерируемой команды в памяти команд
let instrMem;
let tmpVarCnt;

// --- Новые Enum для типов и операций ---
const TypeCodes = new Enum(
    'typeInt',
    'typeFloat',
    'typeString',
    'typeBool',
    'typeArray', // Добавлен тип массива
    'typeNone' // Добавлен тип "нет"
);

const OperCodes = new Enum(
    'opAssign', // 0
    'opAdd',    // 1
    'opSub',    // 2
    'opMul',    // 3
    'opDiv',    // 4
    'opJmp',    // 5
    'opJmpFalse', // 6
    'opJmpTrue',  // 7
    'opLT',     // 8
    'opLE',     // 9
    'opGT',     // 10
    'opGE',     // 11
    'opEQ',     // 12
    'opNE'      // 13
);

// --- Инициализация типов ---
function initTypes() {
    types = [
        { lex: 'integer', size: 4 }, // 0
        { lex: 'real',    size: 8 }, // 1
        { lex: 'string',  size: 64 },// 2
        { lex: 'bool',    size: 1 }, // 3
        { lex: 'array',   size: 0, baseType: -1, length: 0 }, // 4 - Пример структуры для массива
        { lex: 'none',    size: 0 }  // 5
    ];
}


function syntaxError(state, token) {
    let coord = coordsByIndex(token.posStart, buffer);
    drawMiddleEditor('Ошибка',
        `Обнаружена синтаксическая ошибка:\n` +
        `Строка: ${coord.line}, столбец: ${coord.ch}\n` +
        `Состояние анализатора: ${state}\n` +
        `Токен: ${token.name} (${token.lex})`
    );
    drawRightEditor('...', '');
    return false;
}

function typeError(code, token) {
    const errorMessages = {
        1: "Повторное объявление идентификатора",
        2: "Идентификатор не является именем типа",
        3: "Идентификатор не является именем переменной",
        4: "Несовместимость типов",
        5: "Не объявлен идентификатор",
        6: "Некорректный размер массива"
    };

    const message = errorMessages[code] || "Неизвестная ошибка";

    // Вывод ошибки
    printErrorWithPos(`Семантическая ошибка ${code}: ${message}`, token.posStart, buffer);

    // Немедленное прекращение трансляции
    throw new Error(`Type_Error: ${message}`);
    // return false; // unreachable после throw
}


function newTemp(typeIdx) {
    // alignAddress(types[typeIdx].size); // Выравнивание не всегда нужно для временных
    const tempLex = '$' + ++tmpVarCnt;
    const addr = nextAddr; // Здесь нужно выделить место, если оно используется
    // Для упрощения, временные переменные могут не храниться в основной памяти до генерации кода
    // или использовать виртуальные адреса
    const tempVar = {
        lex: tempLex,
        type: typeIdx,
        addr: addr, // Виртуальный или реальный адрес
        val: null
    };
    idents[0].push(tempVar);
    return idents[0].length - 1; // Возвращаем индекс
}

// Выравнивание адреса
function alignAddress(size) {
    while (nextAddr % size !== 0) nextAddr++;
    nextAddr += size;
}

function makeList(instrNum) {
    return [instrNum];
}

function merge(arr1, arr2) {
    if (!arr1) return arr2;
    if (!arr2) return arr1;
    return arr1.concat(arr2);
}

function backPatch(indices, i) {
    if (!indices) return;
    indices.forEach(idx => {
        if (instrMem[idx] && instrMem[idx].includes('?')) {
            instrMem[idx] = instrMem[idx].replace('?', i);
        }
    });
}

function gen(op, arg1, arg2, res) {
    const instrNum = nextInstr++;
    let instrStr = `${instrNum.toString().padStart(3, '0')}: ${op}`;
    if (arg1 !== undefined && arg1 !== -1) instrStr += ` ${arg1}`;
    if (arg2 !== undefined && arg2 !== -1) instrStr += `, ${arg2}`;
    if (res !== undefined && res !== -1) instrStr += ` -> ${res}`;
    instrMem.push(instrStr);
    return instrNum;
}

// --- Семантические действия ---
// A1: Module -> "Program" ID {A1} ... (Обработка ID модуля)
function A1(token) {
    console.log("A1: Обработка ID модуля:", token.lex);
    // Обычно просто сохраняют имя модуля, если нужно
    return true;
}

// A2: Block -> DescriptionList "begin" ListStmt "end" {A2}
function A2() {
    console.log("A2: Завершение блока");
    // Завершение блока, возможно, генерация кода для выхода из области видимости
    return true;
}

// A3: DescriptionList -> DescriptionList Description ";" {A3}
function A3() {
    console.log("A3: Обработка описания списка");
    // Обычно пустое действие, просто продолжает цепочку описаний
    return true;
}

// A4: Description -> Type ListId {A4}
function A4() {
    console.log("A4: Завершение описания переменных");
    // Завершение описания переменных одного типа
    const typeIdx = typesSt.pop(); // Получаем тип из стека
    // Все переменные, добавленные в стек типов до этого, получают этот тип
    // Это требует более сложной логики в A5 и A6, чтобы связать переменные с типом
    // Упрощаем: предположим, что тип был помещен в стек в A7 (Type -> SimpleType)
    // и все идентификаторы, обработанные через A5/A6, используют его.
    return true;
}

// A5: ListId -> ListId "," ID {A5}
function A5(token) {
    console.log("A5: Обработка следующего идентификатора в списке:", token.lex);
    // Добавить идентификатор в текущую таблицу (глобальную) с типом из стека
    const typeIdx = typesSt.top(); // Тип, установленный в A7
    const existingIdx = idents[0].findIndex(v => v.lex === token.lex);
    if (existingIdx !== -1) {
        typeError(1, token); // Повторное объявление
        return false;
    }
    alignAddress(types[typeIdx].size);
    idents[0].push({
        lex: token.lex,
        type: typeIdx,
        addr: nextAddr - types[typeIdx].size // Адрес был установлен alignAddress
    });
    return true;
}

// A6: ListId -> ID {A6}
function A6(token) {
    console.log("A6: Обработка первого идентификатора в списке:", token.lex);
    // Добавить идентификатор в текущую таблицу (глобальную) с типом из стека
    const typeIdx = typesSt.top(); // Тип, установленный в A7
    const existingIdx = idents[0].findIndex(v => v.lex === token.lex);
    if (existingIdx !== -1) {
        typeError(1, token); // Повторное объявление
        return false;
    }
    alignAddress(types[typeIdx].size);
    idents[0].push({
        lex: token.lex,
        type: typeIdx,
        addr: nextAddr - types[typeIdx].size // Адрес был установлен alignAddress
    });
    return true;
}

// A7: Type -> SimpleType {A7}
function A7() {
    console.log("A7: Тип установлен");
    // Тип уже помещен в стек в A8 или A9
    return true;
}

// A8: SimpleType -> ID {A8}
function A8(token) {
    console.log("A8: Обработка типа-идентификатора:", token.lex);
    // Найти тип по имени
    const typeIdx = types.findIndex(t => t.lex === token.lex);
    if (typeIdx === -1) {
        typeError(2, token); // Идентификатор не является именем типа
        return false;
    }
    typesSt.push(typeIdx);
    return true;
}

// A9: ArrayType -> ID "[" INTEGER "]" "of" TypeSpec {A9}
function A9(arraySizeToken) {
    console.log("A9: Обработка типа массива");
    // Требуется обработка размера массива (arraySizeToken.lex) и типа элемента (из стека)
    const elemTypeIdx = typesSt.pop(); // Тип элемента
    const arraySize = arraySizeToken.lex; // INTEGER token.lex
    if (arraySize <= 0) {
        typeError(6, arraySizeToken); // Некорректный размер
        return false;
    }
    const arrayTypeIdx = types.push({
        lex: `array[${arraySize}] of ${types[elemTypeIdx].lex}`,
        size: types[elemTypeIdx].size * arraySize,
        baseType: elemTypeIdx,
        length: arraySize
    }) - 1;
    typesSt.push(arrayTypeIdx); // Положить индекс нового типа массива в стек
    return true;
}

// A10: ListStmt -> ListStmt ";" Stmt {A10}
function A10() {
    console.log("A10: Обработка следующего оператора");
    // Обычно пустое действие, просто продолжает цепочку операторов
    return true;
}

// A11: ListStmt -> Stmt {A11}
function A11() {
    console.log("A11: Обработка первого оператора");
    // Обычно пустое действие
    return true;
}

// A12: Stmt -> Assignment {A12}
function A12() {
    console.log("A12: Завершение оператора присваивания");
    // Обычно пустое действие, если генерация кода уже выполнена в Assignment
    return true;
}

// A13: Stmt -> Repeat {A13}
function A13() {
    console.log("A13: Завершение оператора повторения");
    // Обработка nextlist для repeat
    const untilList = nextlistSt.pop();
    const stmtList = nextlistSt.pop(); // Список из M внутри repeat
    const startAddr = instrSt.pop(); // Адрес начала тела repeat

    backPatch(untilList, startAddr); // Если условие ложно, вернуться к началу тела
    // nextlistSt.push(merge(stmtList, untilList)); // Объединить списки выхода
    return true;
}

// A14: Stmt -> Condition {A14}
function A14() {
    console.log("A14: Завершение условного оператора");
    // Обработка nextlist для if
    const nextList = nextlistSt.pop(); // Список из N или Else
    const falselist = nextlistSt.pop(); // Список из A18
    const truelist = nextlistSt.pop(); // Список из Then

    backPatch(falselist, nextInstr); // Пометить конец Then или Else
    backPatch(truelist, nextInstr);  // Пометить переход из Then
    nextlistSt.push(merge(nextList, merge(falselist, truelist))); // Объединить списки выхода
    return true;
}

// A15: Assignment -> Variable "=" Expression {A15}
function A15() {
    console.log("A15: Обработка присваивания");
    const expr = attrSt.pop(); // {addr, type}
    const varInfo = attrSt.pop(); // {addr, type}

    if (varInfo.type !== expr.type) {
        typeError(4, { posStart: 0, name: 'assign', lex: '=' }); // Используем фиктивный токен
        return false;
    }
    gen(OperCodes.keyOf(OperCodes.opAssign), expr.addr, -1, varInfo.addr);
    return true;
}

// A16: Repeat -> "repeat" ListStmt {M} "until" Expression {A16}
function A16() {
    console.log("A16: Обработка 'until'");
    const expr = attrSt.pop(); // {addr, type, truelist, falselist} - результат Expression
    if (expr.type !== TypeCodes.typeBool) {
        typeError(4, { posStart: 0, name: 'until', lex: 'until' }); // Используем фиктивный токен
        return false;
    }

    const stmtStartAddr = instrSt.pop(); // Адрес начала тела из M

    // Условие repeat: тело выполняется, пока выражение ложно.
    // falselist expr - это куда идти, если выражение ложно (вернуться к телу)
    backPatch(expr.falselist, stmtStartAddr);
    // truelist expr - это куда идти, если выражение истинно (выход из цикла)
    // nextlistSt.push(expr.truelist); // Список выхода из цикла
    nextlistSt.push(expr.truelist);
    nextlistSt.push([]); // Список для M (тела цикла) - пустой, так как тело всегда возвращает управление на проверку
    instrSt.push(stmtStartAddr); // Положить адрес начала тела снова
    return true;
}

// A17: Condition -> "if" Expression {A17} "then" Stmt {A18} [ "else" Stmt {A19} ]
function A17() {
    console.log("A17: Обработка 'if'");
    const expr = attrSt.pop(); // {addr, type, truelist, falselist}
    if (expr.type !== TypeCodes.typeBool) {
        typeError(4, { posStart: 0, name: 'if', lex: 'if' });
        return false;
    }
    // Положить списки в стек для A18 и A19
    nextlistSt.push(expr.falselist); // falselist для Then
    nextlistSt.push(expr.truelist);  // truelist для Then
    return true;
}

// A18: (Часть Then)
function A18() {
    console.log("A18: Обработка 'then'");
    const thenNextList = nextlistSt.pop(); // truelist из A17
    const elseStartList = nextlistSt.pop(); // falselist из A17 (начало Else или конец Then)
    const stmtNextList = nextlistSt.pop(); // nextlist из Stmt Then

    // Создать переход из конца Then к началу Else или за Else
    const jumpToEndThen = gen(OperCodes.opJmp, -1, -1, 0); // goto ?
    const thenExitList = makeList(jumpToEndThen);

    backPatch(thenNextList, nextInstr); // Пометить начало Then
    // nextlistSt.push(merge(elseStartList, thenExitList)); // Список для Else или выхода
    nextlistSt.push(merge(elseStartList, thenExitList));
    return true;
}

// A19: (Часть Else)
function A19() {
    console.log("A19: Обработка 'else'");
    // nextlist из Stmt Else уже на вершине стека
    // Список из A18 (thenExitList) на стеке
    const elseNextList = nextlistSt.pop(); // nextlist из Stmt Else
    const thenExitList = nextlistSt.pop(); // thenExitList из A18

    backPatch(thenExitList, nextInstr); // Пометить переход из Then к концу Else
    nextlistSt.push(merge(elseNextList, thenExitList)); // Объединить списки выхода
    return true;
}

// A20: Variable -> IndexVariable {A20}
// A21: Variable -> ID {A21}
function A21(token) {
    console.log("A21: Обработка переменной (ID):", token.lex);
    const idx = idents[0].findIndex(v => v.lex === token.lex);
    if (idx === -1) {
        typeError(3, token); // Идентификатор не является именем переменной
        return false;
    }
    const varInfo = idents[0][idx];
    attrSt.push({ addr: varInfo, type: varInfo.type });
    return true;
}

// A22: IndexVariable -> ID "[" SimpleExpression "]" {A22}
function A22() {
    console.log("A22: Обработка индексированной переменной");
    const indexExpr = attrSt.pop(); // {addr, type}
    const idToken = attrSt.pop(); // {lex, ...} - ID
    const idx = idents[0].findIndex(v => v.lex === idToken.lex);
    if (idx === -1) {
        typeError(3, idToken);
        return false;
    }
    const varInfo = idents[0][idx];
    // Проверить, что varInfo.type - массив
    if (types[varInfo.type].lex !== 'array') {
         typeError(4, idToken); // Тип не массив
         return false;
    }
    // Проверить тип индекса
    if (indexExpr.type !== TypeCodes.typeInt) {
        typeError(4, { posStart: 0, name: 'index', lex: 'index' });
        return false;
    }
    // Вычислить адрес элемента: addr_base + index * size_elem
    const elemTypeIdx = types[varInfo.type].baseType;
    const tempAddr = newTemp(TypeCodes.typeInt); // Адрес элемента
    gen(OperCodes.opMul, indexExpr.addr, types[elemTypeIdx].size, tempAddr);
    gen(OperCodes.opAdd, varInfo.addr, tempAddr, tempAddr);
    attrSt.push({ addr: idents[0][tempAddr], type: elemTypeIdx });
    return true;
}

// A23: Expression -> SimpleExpression Relation SimpleExpression {A23}
function A23() {
    console.log("A23: Обработка выражения с отношением");
    const right = attrSt.pop(); // {addr, type}
    const relOp = attrSt.pop(); // {op}
    const left = attrSt.pop();  // {addr, type}

    if (left.type !== right.type) {
        typeError(4, relOp.token); // relOp.token - токен операции
        return false;
    }

    const resultTemp = newTemp(TypeCodes.typeBool);
    const opCode = relOp.op;
    gen(opCode, left.addr, right.addr, resultTemp);

    // Для управляемых переходов (если используется)
    const truelist = makeList(nextInstr);
    gen(OperCodes.opJmpTrue, resultTemp, -1, 0); // if resultTemp then goto ?
    const falselist = makeList(nextInstr);
    gen(OperCodes.opJmp, -1, -1, 0); // goto ?

    attrSt.push({ addr: idents[0][resultTemp], type: TypeCodes.typeBool, truelist: truelist, falselist: falselist });
    return true;
}

// A24: Expression -> SimpleExpression {A24}
function A24() {
    console.log("A24: Обработка простого выражения как выражения");
    // Просто передать атрибуты дальше
    // attrSt.top() уже содержит {addr, type, truelist, falselist} от SimpleExpression
    return true;
}

// A25: Relation -> "<" {A25} | "<=" {A25} | ">" {A26} | ">=" {A27} | "==" {A28} | "!=" {A29}
function A25(token) { // < (0)
    attrSt.push({ op: OperCodes.opLT, token: token });
    return true;
}
function A26(token) { // > (2)
    attrSt.push({ op: OperCodes.opGT, token: token });
    return true;
}
function A27(token) { // >= (3)
    attrSt.push({ op: OperCodes.opGE, token: token });
    return true;
}
function A28(token) { // == (5)
    attrSt.push({ op: OperCodes.opEQ, token: token });
    return true;
}
function A29(token) { // != (4)
    attrSt.push({ op: OperCodes.opNE, token: token });
    return true;
}
function A30(token) { // <= (1)
    attrSt.push({ op: OperCodes.opLE, token: token });
    return true;
}

// A31: SimpleExpression -> SimpleExpression AddOp Term {A31}
function A31() {
    console.log("A31: Обработка сложения/вычитания");
    const term = attrSt.pop(); // {addr, type}
    const addOp = attrSt.pop(); // {op}
    const simpleExpr = attrSt.pop(); // {addr, type}

    if (simpleExpr.type !== term.type) {
        typeError(4, addOp.token);
        return false;
    }
    // Проверка типа для || (логическое ИЛИ)
    if (addOp.op === OperCodes.opAdd + 2 && simpleExpr.type !== TypeCodes.typeBool) { // Условное значение для ||
         typeError(4, addOp.token);
         return false;
    }

    const resultTemp = newTemp(simpleExpr.type);
    gen(addOp.op, simpleExpr.addr, term.addr, resultTemp);
    attrSt.push({ addr: idents[0][resultTemp], type: simpleExpr.type });
    return true;
}

// A32: SimpleExpression -> Term {A32}
function A32() {
    console.log("A32: Обработка терма как SimpleExpression");
    // Просто передать атрибуты дальше
    // attrSt.top() уже содержит {addr, type}
    return true;
}

// A33: AddOp -> "+" {A33} | "-" {A34} | "||" {A35}
function A33(token) { // +
    attrSt.push({ op: OperCodes.opAdd, token: token });
    return true;
}
function A34(token) { // -
    attrSt.push({ op: OperCodes.opSub, token: token });
    return true;
}
function A35(token) { // ||
    attrSt.push({ op: OperCodes.opAdd + 2, token: token }); // Условное значение
    return true;
}

// A36: Term -> Term MulOp Factor {A36}
function A36() {
    console.log("A36: Обработка умножения/деления");
    const factor = attrSt.pop(); // {addr, type}
    const mulOp = attrSt.pop(); // {op}
    const term = attrSt.pop(); // {addr, type}

    if (term.type !== factor.type) {
        typeError(4, mulOp.token);
        return false;
    }
    // Проверка типа для && (логическое И)
    if (mulOp.op === OperCodes.opMul + 2 && term.type !== TypeCodes.typeBool) { // Условное значение для &&
         typeError(4, mulOp.token);
         return false;
    }

    const resultTemp = newTemp(term.type);
    gen(mulOp.op, term.addr, factor.addr, resultTemp);
    attrSt.push({ addr: idents[0][resultTemp], type: term.type });
    return true;
}

// A37: Term -> Factor {A37}
function A37() {
    console.log("A37: Обработка фактора как терма");
    // Просто передать атрибуты дальше
    // attrSt.top() уже содержит {addr, type}
    return true;
}

// A38: MulOp -> "*" {A38} | "/" {A39} | "&&" {A40}
function A38(token) { // *
    attrSt.push({ op: OperCodes.opMul, token: token });
    return true;
}
function A39(token) { // /
    attrSt.push({ op: OperCodes.opDiv, token: token });
    return true;
}
function A40(token) { // &&
    attrSt.push({ op: OperCodes.opMul + 2, token: token }); // Условное значение
    return true;
}

// A41: Factor -> Const {A41}
// A42: Factor -> Variable {A42}
// A43: Factor -> "(" Expression ")" {A43}
function A43() {
    console.log("A43: Обработка выражения в скобках");
    // attrSt.top() уже содержит {addr, type, ...} от Expression
    // Просто передать дальше
    return true;
}

// A44: Const -> INTEGER {A44}
function A44(token) {
    console.log("A44: Обработка целой константы:", token.lex);
    const tempIdx = newTemp(TypeCodes.typeInt);
    const tempVar = idents[0][tempIdx];
    tempVar.val = token.lex; // Сохраняем значение
    attrSt.push({ addr: tempVar, type: TypeCodes.typeInt });
    return true;
}

// A45: Const -> REAL {A45}
function A45(token) {
    console.log("A45: Обработка вещественной константы:", token.lex);
    const tempIdx = newTemp(TypeCodes.typeFloat);
    const tempVar = idents[0][tempIdx];
    tempVar.val = token.lex;
    attrSt.push({ addr: tempVar, type: TypeCodes.typeFloat });
    return true;
}

// A46: Const -> STRING {A46}
function A46(token) {
    console.log("A46: Обработка строковой константы:", token.lex);
    const tempIdx = newTemp(TypeCodes.typeString);
    const tempVar = idents[0][tempIdx];
    tempVar.val = token.lex;
    attrSt.push({ addr: tempVar, type: TypeCodes.typeString });
    return true;
}

// A47: Const -> BOOL {A47}
function A47(token) {
    console.log("A47: Обработка булевой константы:", token.lex);
    const tempIdx = newTemp(TypeCodes.typeBool);
    const tempVar = idents[0][tempIdx];
    tempVar.val = token.attr === 1; // attr 1 для True, 0 для False
    attrSt.push({ addr: tempVar, type: TypeCodes.typeBool });
    return true;
}

// A48: M -> epsilon {A48} (для repeat)
function A48() {
    console.log("A48: M для repeat");
    instrSt.push(nextInstr); // Сохранить адрес начала тела repeat
    return true;
}

// A49: N -> epsilon {A49} (для if)
function A49() {
    console.log("A49: N для if");
    // Создать списки для true и false
    const falselist = makeList(nextInstr);
    gen(OperCodes.opJmpFalse, -1, -1, 0); // Заглушка, адрес будет подставлен позже
    const truelist = makeList(nextInstr);
    gen(OperCodes.opJmp, -1, -1, 0); // Заглушка
    // attrSt.push({ truelist: truelist, falselist: falselist }); // Передаем через стек атрибутов
    nextlistSt.push(falselist); // Помещаем в стек nextlist для последовательности
    nextlistSt.push(truelist);
    return true;
}


/** Выполнение семантических действий. true - успешно, false - ошибка */
function semanticAction(actionCode, token) {
    console.log("Выполнение действия:", actionCode, "с токеном:", token.name);
    const actionNum = parseInt(actionCode.match(/\d+/)[0], 10);
    switch (actionNum) {
        case 1: return A1(token);
        case 2: return A2();
        case 3: return A3();
        case 4: return A4();
        case 5: return A5(token);
        case 6: return A6(token);
        case 7: return A7();
        case 8: return A8(token);
        case 9: return A9(token); // token содержит INTEGER
        case 10: return A10();
        case 11: return A11();
        case 12: return A12();
        case 13: return A13();
        case 14: return A14();
        case 15: return A15();
        case 16: return A16();
        case 17: return A17();
        case 18: return A18();
        case 19: return A19();
        case 20: return A20(); // Variable -> IndexVariable
        case 21: return A21(token);
        case 22: return A22();
        case 23: return A23();
        case 24: return A24();
        case 25: return A25(token);
        case 26: return A26(token);
        case 27: return A27(token);
        case 28: return A28(token);
        case 29: return A29(token);
        case 30: return A30(token);
        case 31: return A31();
        case 32: return A32();
        case 33: return A33(token);
        case 34: return A34(token);
        case 35: return A35(token);
        case 36: return A36();
        case 37: return A37();
        case 38: return A38(token);
        case 39: return A39(token);
        case 40: return A40(token);
        case 41: return A41(token); // Factor -> Const
        case 42: return A42(token); // Factor -> Variable
        case 43: return A43();
        case 44: return A44(token);
        case 45: return A45(token);
        case 46: return A46(token);
        case 47: return A47(token);
        case 48: return A48();
        case 49: return A49();
        // Добавьте другие действия по мере необходимости
        default:
            console.error("Неизвестное семантическое действие:", actionCode);
            return false;
    }
    // return false; // unreachable
}


const nonTerms = new Map();
const terms = new Map();
const termsNonTerms = new Map();

/** СУ-трансляция. true, если нет ошибок */
function SUT() {
    console.log("Начало СУ-трансляции");
    if (tokenList.length === 0) {
        drawMiddleEditor('Ошибка', 'Список токенов пуст!');
        return false;
    }
    if (!xmlString) {
        drawMiddleEditor('Ошибка', 'LR-таблица не загружена!');
        return false;
    }

    xml = new DOMParser().parseFromString(xmlString, 'text/xml');

    fillTermsNonTerms();

    idents = [
        [ /* Глобальные переменные */ ],
    ];
    initTypes(); // Инициализация типов

    offset = 0;
    nextAddr = 0;
    nextInstr = 0;
    instrMem = [];
    tmpVarCnt = 0;
    Q = [];

    tblSt = new Stack(0);
    attrSt = new Stack();
    instrSt = new Stack();
    typesSt = new Stack();
    offsetSt = new Stack();
    nextlistSt = new Stack();

    let tokenCnt = 0;
    let token = tokenList[tokenCnt];
    if (!token) {
        drawMiddleEditor('Ошибка', 'Первый токен не определен!');
        return false;
    }
    let prevToken = {...token};
    let parserState = 1; // текущее состояние стека парсера
    let parserSt = new Stack(1); // начальное состояние в стек

    const TypesElemTR = new Enum(
        'ERROR',  // элемент ошибки (0)
        'SHIFT',  // элемент сдвига (1)
        'REDUCE', // элемент свертки (2)
        'BREAK'   // элемент останова (3)
    );

    let elemTR = { type: TypesElemTR.ERROR }; // элемент ошибки

    if (token.code > TypesElemTR.ERROR) { // нет лексической ошибки (предполагается, что коды токенов > 0)

        let lex = token.name;

        // пока не элемент останова
        while (elemTR.type !== TypesElemTR.BREAK && tokenCnt < tokenList.length) { // Добавлена проверка длины списка токенов

            parserState = parserSt.top(); // текущее состояние анализатора
            if (!parserState) {
                drawMiddleEditor('Ошибка', `Состояние анализатора не определено (токен ${token.name}).`);
                return false;
            }
            let xmlNode;
            try {
                xmlNode = getXmlNode(parserState, lex);
            } catch (e) {
                drawMiddleEditor('Ошибка', `Не найдена запись в SLR-таблице для состояния ${parserState} и лексемы '${lex}'.`);
                console.error(e);
                return false;
            }

            elemTR = {
                type: parseInt(xmlNode.getAttribute('ElType')),
                par: parseInt(xmlNode.getAttribute('ElPar')),
                left: xmlNode.getAttribute('Left'),
                act: xmlNode.getAttribute('Act')
            };

            console.log(`Состояние: ${parserState}, Лексема: ${lex}, TR: ${TypesElemTR.keyOf(elemTR.type)}, Par: ${elemTR.par}, Left: ${elemTR.left}, Act: ${elemTR.act}`);

            switch (elemTR.type) {

                case TypesElemTR.ERROR: // синтаксическая ошибка
                    syntaxError(parserState, token);
                    return false;

                case TypesElemTR.SHIFT: // элемент сдвига
                    parserSt.push(elemTR.par);  // состояние в стек
                    if (terms.has(lex)) {
                        prevToken = {...token};
                        token = tokenList[++tokenCnt];
                        if (!token) {
                             // Достигнут конец списка токенов
                             if (elemTR.par === 0) { // Предполагаем, что состояние 0 ведет к ошибке, если нет токена
                                 drawMiddleEditor('Ошибка', `Неожиданный конец входного потока.`);
                                 return false;
                             }
                             // Или может быть допустимое состояние останова без следующего токена?
                             // Это зависит от SLR-таблицы. Обычно ожидается EOF.
                             // Проверим, если следующее состояние - это EOF и лексема - eof.
                             // Если лексема не eof, но список кончился - ошибка.
                             // Пока оставим как есть, если token === undefined, цикл остановится на следующей итерации.
                             // console.log("Достигнут конец списка токенов.");
                             // break; // Прерываем сдвиг, ожидаем REDUCE или ERROR
                        } else {
                            if (token.code === 0) { // Предполагаем, что 0 - код лексической ошибки
                                drawMiddleEditor('Ошибка', 'Обнаружена лексическая ошибка.');
                                return false;
                            }
                        }
                    }
                    lex = token ? token.name : 'eof'; // Обновляем lex, если токен закончился, используем 'eof'
                    break;

                case TypesElemTR.REDUCE: // элемент свертки
                    console.log(`Свертка: R${elemTR.par} -> ${elemTR.left}, Действие: ${elemTR.act}`);
                    for (let i = 1; i <= elemTR.par; i++) {
                        parserSt.pop(); // удаление верхних элементов стека
                    }

                    parserState = parserSt.top(); // новое состояние после pop
                    lex = elemTR.left; // нетерминал левой части как новый входной символ

                    if (elemTR.act != null && elemTR.act != '') { // есть действие
                        console.log(`Выполняется действие: ${elemTR.act}`);
                        if (!semanticAction(elemTR.act, prevToken)) { // выполнить действия
                            console.log("Семантическое действие вернуло false.");
                            return false; // Ошибка выполнена в action или typeError
                        }
                    }
                    // После свертки нужно снова получить действие из таблицы для нового состояния и лексемы (goto)
                    // Цикл while продолжается.
                    break;

                case TypesElemTR.BREAK:
                    console.log("Конец разбора (BREAK).");
                    break; // Выйти из while
            }
        }

        if (elemTR.type === TypesElemTR.BREAK) {
             gen('stop');
             drawMiddleEditor('Результат', instrMem.join('\n'));

             const idents_tbl = [];
             idents.forEach((subarray, tableIndex) => {
                 subarray.forEach((item, rowIndex) => {
                     const row = [tableIndex];
                     if (rowIndex !== 0) row[0] = '';

                     let val = item.val !== undefined ? item.val : '';
                     let type_name = types[item.type] ? types[item.type].lex : 'unknown';

                     row.push(
                         item.lex,
                         type_name,
                         (item.addr !== undefined) ? item.addr.toString().padStart(3, '0') : '',
                         val
                     );
                     idents_tbl.push(row);
                 });
             });

             drawRightTable(
                 'Память', ['№ табл.', 'Лексема', 'Тип', 'Адрес', 'Значение'],
                 idents_tbl
             );
             return true;
        } else {
             drawMiddleEditor('Ошибка', 'Разбор не завершен корректно.');
             return false;
        }

    } else {
         drawMiddleEditor('Ошибка', 'Первый токен указывает на лексическую ошибку.');
         return false;
    }

    // drawMiddleEditor('Результат', instrMem.join('\n')); // Убрано, так как генерируется в BREAK
    // drawRightTable(...); // Убрано, так как генерируется в BREAK

    // return true; // Убрано, так как возвраты внутри логики BREAK
}


function fillTermsNonTerms() {
    const nonTermsNodes = xml.getElementsByTagName('Neterms')[0].getElementsByTagName('Column');
    for (let i = 0; i < nonTermsNodes.length; i++) {
        const node = nonTermsNodes[i];
        const colNum = parseInt(node.getAttribute('ColNum'));
        const lexeme = node.getAttribute('Lexeme');
        nonTerms.set(lexeme, colNum);
        termsNonTerms.set(lexeme, colNum);
    }

    const termsNodes = xml.getElementsByTagName('Terms')[0].getElementsByTagName('Column');
    for (let i = 0; i < termsNodes.length; i++) {
        const node = termsNodes[i];
        const colNum = parseInt(node.getAttribute('ColNum'));
        const lexeme = node.getAttribute('Lexeme');
        terms.set(lexeme, colNum);
        termsNonTerms.set(lexeme, colNum);
    }
}

function getXmlNode(state, lex) {
    let resultNode = null;

    const rows = xml.getElementsByTagName('Row');
    for (let i = 0; i < rows.length; i++) {
        const node = rows[i];
        if (state != parseInt(node.getAttribute('NSost'))) continue;

        let colNum = -1;
        if (termsNonTerms.has(lex)) {
            colNum = termsNonTerms.get(lex);
            const childNodes = node.childNodes;
            for (let j = 0; j < childNodes.length; j++) {
                const childNode = childNodes[j];
                if (childNode.nodeType != 1) continue; // Пропускаем ненужные элементы

                if (colNum === parseInt(childNode.getAttribute('ColNum'))) {
                    resultNode = childNode;
                    break;
                }
            }
        }
        if (resultNode) break;
    }

    if (!resultNode) {
        throw new Error(`Узел XML не найден для состояния ${state} и лексемы '${lex}'`);
    }

    return resultNode;
}
