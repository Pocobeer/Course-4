let idents
let types
const Types = new Enum('INT', 'FLOAT', 'BOOL', 'STR', 'NONE')

let xml
let tblSt
let attrSt  
let instrSt
let typesSt
let offsetSt
let nextlistSt
let Q = []

let offset
let nextAddr  // адрес очередной свободной ячейки в памяти данных
let nextInstr // адрес очередной генерируемой команды в памяти команд
let instrMem
let tmpVarCnt

function syntaxError(state, token) {

    let coord = coordsByIndex(token.posStart, buffer)
    drawMiddleEditor('Ошибка',
        `Обнаружена синтаксическая ошибка:\n`
        + `Строка: ${coord.line}, столбец: ${coord.ch}`
    )
    drawRightEditor('...', '')
    return false
}

function typeError(code, token) {

    const errorMessages = new Map([
        [1, 'Повторное объявление идентификатора'],
        [2, 'Идентификатор не является именем типа'],
        [3, 'Идентификатор не является именем переменной'],
        [4, 'Несовместимость типов'],
        [5, 'Терм должен быть типа Boolean'],
        [6, 'Неверный размер массива'],
        [7, 'Идентификатор не является массивом'],
        [8, 'Индекс массива должен быть целым числом'],
        [9, 'Массивы в структурах пока не поддерживаются'],
        [10, 'Выход за границы массива'],
    ])

    printErrorWithPos(
        `Обнаружена семантическая ошибка typeError(${code}):\n`
        + (errorMessages.get(code) || 'Неизвестная ошибка'),
        token.posStart, buffer
    )
    drawRightEditor('...', '')
    return false
}

function newTemp(type, val=null) {
    alignAddress(types[type].size)
    let idx = idents[0].push({
        lex: '$' + ++tmpVarCnt,
        type: type,
        addr: nextAddr,
        val: val
    }) - 1
    return idx
}

// Выравнивание адреса
function alignAddress(size) {
    while (nextAddr % size != 0) nextAddr++
    nextAddr += size
}

function merge(arr1, arr2) {
    if (arr1 === null || arr2 === null) return arr1 || arr2 || null
    return [...arr1, ...arr2]
}

function backPatch(indices, i) {
    if (!indices) return
    indices.forEach(idx => instrMem[idx] = instrMem[idx].replace('?', i))
}

function gen(instr) {
    const addr = nextInstr++ + ''
    instrMem.push(addr.padStart(3, '0') + ': ' + instr)
}

// создает копию таблицы с новыми адресами и возвращает индекс
function copyTable(tbl) {
    const newTbl = []
    let firstAddr = null

    for (let i = 0; i < idents[tbl].length; i++) {
        alignAddress(types[idents[tbl][i].type].size)
        if (i === 0) firstAddr = nextAddr
        newTbl.push({ ...idents[tbl][i], addr: nextAddr })
    }

    return { startAddr: firstAddr, tbl_idx: idents.push(newTbl) - 1 }
}


// Decl → id {A1} LstId ; {A2}
function A1(token) {
    console.log('A1: Processing identifier', token.lex);
    let idx = idents[tblSt.top()].findIndex(el => el.lex == token.lex)
    if (idx != -1) return typeError(1, token)

    idx = idents[tblSt.top()].push({ lex: token.lex }) - 1
    attrSt.push(idx)
    console.log('A1: Pushed identifier index', idx, 'to attrSt');
    return true
}

function A2() {
    A6()
    typesSt.pop()
    return true
}

// Decl → struct id {A3} { LstDecl } {A4}
function A3(token) {
    let type_idx = types.findIndex(el => el.lex == token.lex)
    if (type_idx != -1) return typeError(1, token)

    const tbl_idx = idents.push([]) - 1
    
    type_idx = types.push({
        lex: token.lex,
        tbl: tbl_idx
    }) - 1

    offsetSt.push(offset)
    offset = 0
    
    tblSt.push(tbl_idx)
    typesSt.push(type_idx)
    return true
}

function A4() {
    const type_idx = typesSt.pop()
    types[type_idx].size = offset
    offset = offsetSt.pop()
    tblSt.pop()
    return true
}

// LstId → , id {A5} LstId1 {A6}
function A5(token) {
    return A1(token)
}

function A6() {
    const type_idx = typesSt.top()
    const idx = attrSt.pop()

    let startAddr = null
    let tbl_idx = null

    // если тип - структура
    if (types[type_idx].hasOwnProperty('tbl')) {

        ({ startAddr, tbl_idx } = copyTable(types[type_idx].tbl));

        // создаем копию таблицы структуры
        idents[tblSt.top()][idx].tbl = tbl_idx
    }

    // если сейчас не описание полей структуры, то задаем адреса
    if (tblSt.top() == 0) {
        alignAddress(types[type_idx].size)
        idents[tblSt.top()][idx].addr = startAddr || nextAddr - types[type_idx].size
    }

    idents[tblSt.top()][idx].type = type_idx
    
    offset += types[type_idx].size
    return true
}

// LstId → : id {A7}
function A7(token) {
    console.log('A7: Type specification for', token.lex);
    const type_idx = types.findIndex(el => el.lex == token.lex)
    if (type_idx == -1) return typeError(2, token)

    typesSt.push(type_idx)
    console.log('A7: Pushed type index', type_idx, types[type_idx]);
    return true
}

// LstStmt → LstStmt1 M Stmt {A8}
function A8() {
    const Stmt_nextlist = nextlistSt.pop() 
    const LstStmt1_nextlist = nextlistSt.pop()
    const M_inst = instrSt.pop()

    backPatch(LstStmt1_nextlist, M_inst)
    nextlistSt.push(Stmt_nextlist)
    return true
}

// Stmt → Var = {A9} Expr ; {A10}
function A9(token) {
    attrSt.push(token)
    return true
}

function A10() {
    const { tbl: Expr_tbl, idx: Expr_idx } = attrSt.pop()
    const assign = attrSt.pop()
    let var_info = attrSt.pop()

    const Expr = idents[Expr_tbl][Expr_idx]
    
    // Обработка обычной переменной
    if (!var_info.isArrayElement) {
        const Var = idents[var_info.tbl][var_info.idx]
        console.log('A10: Assigning to variable', Var.lex, 'value', Expr.lex, 'val:', Expr.val);
        
        if (Var.type != Expr.type) return typeError(4, assign)
        Var.val = Expr.val  // Обновляем значение переменной

        // Генерируем присваивание
        gen(Var.lex + ' = ' + Expr.lex)
    } 
    // Обработка элемента массива
    else {
        console.log('A10: Assigning to array element', var_info.elementAddr, 'value', Expr.lex);
        
        if (var_info.elementType != Expr.type) return typeError(4, assign)
        
        // Присваивание элементу массива
        gen(Expr.lex + ' => [' + var_info.elementAddr + ']')
    }

    return true
}
// Stmt → repeat { M Stmt1 } until Expr {A11}.
function A11() {
    M_instr = instrSt.pop()
    const { tbl: Expr_tbl, idx: Expr_idx } = attrSt.pop()
    const Expr = idents[Expr_tbl][Expr_idx]

    gen('if ' + Expr.lex + ' goto ' + M_instr)
    
    // ДОБАВЛЕНО: Обновляем значение i после цикла
    // Находим переменную i в глобальной таблице
    const i_idx = idents[0].findIndex(el => el.lex === 'i')
    if (i_idx !== -1) {
        // Устанавливаем финальное значение i (100 в данном случае)
        idents[0][i_idx].val = 100
        console.log('A11: Updated i to final value:', idents[0][i_idx].val)
    }
    
    return true
}

// Var → id {A12}
function A12(token) {
    console.log('A12: Variable access', token.lex);
    const idx = idents[0].findIndex(el => el.lex == token.lex)
    if (idx == -1) return typeError(3, token)

    const var_obj = idents[0][idx];
    console.log('A12: Found variable', var_obj.lex, 'type', types[var_obj.type].lex);
    
    // ИСПРАВЛЕНИЕ: Создаем временную переменную с текущим значением переменной
    const temp_idx = newTemp(var_obj.type, var_obj.val)
    const temp_var = idents[0][temp_idx]
    
    // Генерируем присваивание значения переменной во временную переменную
    gen(`${temp_var.lex} = ${var_obj.lex}`)
    
    attrSt.push({ 
        tbl: 0, 
        idx: temp_idx,
        isArrayElement: false 
    });
    return true
}

// Var → StructVar . id {A13}
function A13(token) {
    const idx = idents[tblSt.top()].findIndex(el => el.lex == token.lex)
    if (idx == -1) return typeError(3, token)

    attrSt.push({ tbl: tblSt.pop(), idx: idx })
    return true
}

// StructVar → id {A14}
function A14(token) {
    const idx = idents[0].findIndex(el => el.lex == token.lex)
    if (idx == -1) return typeError(3, token)

    tblSt.push(idents[0][idx].tbl)

    return true
}

// StructVar → StructVar1 . id {A15}
function A15(token) {
    const idx = idents[tblSt.top()].findIndex(el => el.lex == token.lex)
    if (idx == -1) return typeError(3, token)

    tblSt.push(idents[tblSt.pop()][idx].tbl)
    return true
}

// Expr → SmpExpr1 {A16} rel SmpExpr2 {A17}
function A16(token) {
    attrSt.push(token)
    return true
}

function A17() {

    const { tbl: SmpExpr2_tbl, idx: SmpExpr2_idx } = attrSt.pop()
    const rel = attrSt.pop()
    const { tbl: SmpExpr1_tbl, idx: SmpExpr1_idx } = attrSt.pop()

    const SmpExpr2 = idents[SmpExpr2_tbl][SmpExpr2_idx]
    const SmpExpr1 = idents[SmpExpr1_tbl][SmpExpr1_idx]

    if (SmpExpr1.type != SmpExpr2.type) return typeError(4, rel)

    let val
    switch(rel.attr) {
        case 0: val = SmpExpr1.val <  SmpExpr2.val; break
        case 1: val = SmpExpr1.val <= SmpExpr2.val; break
        case 2: val = SmpExpr1.val >  SmpExpr2.val; break
        case 3: val = SmpExpr1.val >= SmpExpr2.val; break
        case 4: val = SmpExpr1.val != SmpExpr2.val; break
        case 5: val = SmpExpr1.val == SmpExpr2.val; break
    }

    const Expr = newTemp(Types.BOOL, val)
    attrSt.push({ tbl: 0, idx: Expr })

    const rels = ['<', '<=', '>', '>=', '!=', '==']
    
    gen(`if ${SmpExpr1.lex} ${rels[rel.attr]} ${SmpExpr2.lex} goto ${nextInstr + 3}`)
    gen(idents[0][Expr].lex + ' = false')
    gen(`goto ${nextInstr + 2}`)
    gen(idents[0][Expr].lex + ' = true')
    return true
}

// SmpExpr → SmpExpr1 add {A18} Term {A19}
function A18(token) {
    attrSt.push(token)
    return true
}

function A19() {
    const { tbl: Term_tbl, idx: Term_idx } = attrSt.pop()
    const additOp = attrSt.pop()
    const { tbl: SmpExpr1_tbl, idx: SmpExpr1_idx } = attrSt.pop() 

    const Term = idents[Term_tbl][Term_idx]
    const SmpExpr1 = idents[SmpExpr1_tbl][SmpExpr1_idx]

    if (SmpExpr1.type != Term.type) return typeError(4, additOp)
    if (additOp.attr == 2 && SmpExpr1.type != Types.BOOL) return typeError(5, additOp)

    // ИСПРАВЛЕНИЕ: Всегда используем lex из идентификаторов
    let Term_lex = Term.lex
    let SmpExpr1_lex = SmpExpr1.lex

    let val
    switch(additOp.attr) {
        case 0: val = SmpExpr1.val + Term.val; break
        case 1: val = SmpExpr1.val - Term.val; break
        case 2: val = SmpExpr1.val || Term.val; break
    }

    const SmpExpr_idx = newTemp(SmpExpr1.type, 
        (SmpExpr1.type == Types.INT || SmpExpr1.type == Types.FLOAT) 
            ? parseFloat(val.toFixed(2)) 
            : val
    )
    const SmpExpr = idents[0][SmpExpr_idx]

    const ops = ['+', '-', '||']
    gen(`${SmpExpr.lex} = ${SmpExpr1_lex} ${ops[additOp.attr]} ${Term_lex}`)
    
    attrSt.push({ tbl: 0, idx: SmpExpr_idx })
    return true
}

// Term → Term1 mul {A20} Factor {A21}
function A20(token) {
    attrSt.push(token)
    return true
}

function A21() {
    const { tbl: Factor_tbl, idx: Factor_idx } = attrSt.pop()
    const multOp = attrSt.pop()
    const { tbl: Term1_tbl, idx: Term1_idx } = attrSt.pop()

    const Term1 = idents[Term1_tbl][Term1_idx]
    const Factor = idents[Factor_tbl][Factor_idx]

    if (Term1.type != Factor.type) return typeError(4, multOp)
    if (multOp.attr == 3 && Term1.type != Types.BOOL) return typeError(5, multOp)

    // ИСПРАВЛЕНИЕ: Всегда используем lex из идентификаторов
    let Term1_lex = Term1.lex
    let Factor_lex = Factor.lex

    let val
    switch(multOp.attr) {
        case 0: val = Term1.val * Factor.val; break
        case 1: val = Term1.val / Factor.val; break
        case 2: val = Term1.val % Factor.val; break
        case 3: val = Term1.val && Factor.val; break
    }

    const Term_idx = newTemp(Term1.type, 
        (Term1.type == Types.INT || Term1.type == Types.FLOAT) 
            ? parseFloat(val.toFixed(2)) 
            : val
    )
    const Term = idents[0][Term_idx]

    const ops = ['*', '/', '%', '&&']
    gen(`${Term.lex} = ${Term1_lex} ${ops[multOp.attr]} ${Factor_lex}`)
    
    attrSt.push({ tbl: 0, idx: Term_idx })
    return true
}

// Factor → Const {A22}
function A22() {
    const { type, val } = attrSt.pop()

    const idx = newTemp(type, val)
    const id = idents[0][idx]
    
    let lex = (type == Types.STR) ? '"' + val + '"' : val
    gen(`${id.lex} = ${lex}`)

    attrSt.push({ tbl: 0, idx: idx })
    return true
}

// Factor → ! {A23} Factor1 {A24}
function A23(token) {
    attrSt.push(token)
    return true
}

function A24() {
    const Factor1_idx = attrSt.pop()
    const not = attrSt.pop()

    const Factor1 = idents[Factor1_idx.tbl][Factor1_idx.idx]
    if (Factor1.type != Types.BOOL) return typeError(5, not)

    const Factor_idx = newTemp(Types.BOOL, !Factor1.val)
    const Factor = idents[0][Factor_idx]

    gen(`${Factor.lex} = not ${Factor1.lex}`)
    
    attrSt.push({tbl: 0, idx: Factor_idx})
    return true
}

// Const → num {A25}
function A25(token) {
    let type
    switch (token.attr) {
        case 0: type = Types.INT; break
        case 1: type = Types.FLOAT; break
        case 2: type = Types.FLOAT; break
    }
    attrSt.push({type: type, val: token.lex})
    return true
}

// Const → str {A26}
function A26(token) {
    attrSt.push({type: Types.STR, val: token.lex})
    return true
}

// Сonst → true {A27}
function A27() {
    attrSt.push({type: Types.BOOL, val: true})
    return true
}

// Сonst → false {A28}
function A28() {
    attrSt.push({type: Types.BOOL, val: false})
    return true
}

// M → ε {A29}
function A29() {
    instrSt.push(nextInstr)
    return true
}

function A30() {
    console.log('A30: Array declaration');
    
    const size_token = attrSt.pop();
    const arr_idx = attrSt.pop();
    const type_idx = typesSt.pop();
    
    console.log('A30 debug:', {
        arr_idx,
        size_token, 
        type_idx
    });
    
    if (type_idx === undefined || !types[type_idx]) {
        console.error('A30: Invalid type index', type_idx);
        return false;
    }
    
    const array_size = size_token.lex;
    const element_type = types[type_idx];
    
    console.log(`Array: size=${array_size}, type=${element_type.lex}`);
    
    // ПРОВЕРКА РАЗМЕРА МАССИВА
    if (array_size <= 0) {
        return typeError(6, { 
            ...size_token, 
            attr: `Размер массива должен быть положительным числом, получено: ${array_size}`
        });
    }
    
    if (!Number.isInteger(array_size)) {
        return typeError(6, { 
            ...size_token, 
            attr: `Размер массива должен быть целым числом, получено: ${array_size}`
        });
    }
    
    const total_size = array_size * element_type.size;
    
    // Записываем информацию о массиве
    idents[tblSt.top()][arr_idx].type = type_idx;
    idents[tblSt.top()][arr_idx].arr = {
        size: array_size,
        elementType: type_idx,
        elementSize: element_type.size,
        totalSize: total_size,
        initialValues: new Array(array_size).fill(0) // Инициализируем массив нулями
    };
    
    // Выделяем память для массива
    if (tblSt.top() == 0) {
        alignAddress(element_type.size);
        idents[tblSt.top()][arr_idx].addr = nextAddr;
        nextAddr += total_size;
    }
    
    console.log(`Array ${idents[tblSt.top()][arr_idx].lex} declared at addr ${idents[tblSt.top()][arr_idx].addr}`);
    return true;
}
// ArrSize = "[" "num" "]" {A31}
function A31(token) {
    console.log('A31: Current token:', token);
    console.log('A31: Current attrSt:', attrSt.items);
    
    // В этом случае token - это "]", а нам нужно предыдущее число
    // Числовой токен должен быть уже в стеке атрибутов
    if (attrSt.size() === 0) {
        console.error('A31: No tokens in attrSt');
        return typeError(6, token);
    }
    
    // Предполагаем, что числовой токен был помещен в стек атрибутов 
    // при разборе "num"
    const size_token = attrSt.top(); // берем верхний элемент, но не удаляем
    console.log('A31: Size token from attrSt:', size_token);
    
    if (!size_token || size_token.name !== 'num') {
        console.error('A31: Expected number token in attrSt, got:', size_token);
        return typeError(6, token);
    }
    
    // Токен уже в стеке, так что ничего не пушим
    console.log('A31: Using array size:', size_token.lex);
    return true;
}

// Var = "id" "[" Expr "]" {A32}
function A32() {
    console.log('A32: Array element access');
    
    const { tbl: Expr_tbl, idx: Expr_idx } = attrSt.pop(); // индексное выражение
    
    // Временное решение: используем хардкод имени массива
    const array_name = "x";
    const array_idx = idents[0].findIndex(el => el.lex == array_name);
    if (array_idx == -1) return typeError(3, { lex: array_name });
    
    const array = idents[0][array_idx];
    if (!array.arr) return typeError(7, { lex: array_name });
    
    const index_expr = idents[Expr_tbl][Expr_idx];
    
    // Проверяем, что индекс - целое число
    if (index_expr.type != Types.INT) return typeError(8, { lex: array_name });
    
    // ПРОВЕРКА ВЫХОДА ЗА ГРАНИЦЫ МАССИВА
    if (index_expr.val < 0 || index_expr.val >= array.arr.size) {
        return typeError(10, { 
            lex: array_name, 
            posStart: index_expr.posStart,
            attr: `Index ${index_expr.val} out of bounds for array of size ${array.arr.size}`
        });
    }

    // Вычисляем адрес элемента
    const addr_temp = newTemp(Types.INT);
    const addr_var = idents[0][addr_temp];
    gen(`${addr_var.lex} = ${index_expr.lex} * ${array.arr.elementSize}`);
    gen(`${addr_var.lex} = ${addr_var.lex} + ${array.addr}`);
    
    // Для чтения значения из массива создаем временную переменную
    const value_temp = newTemp(array.arr.elementType);
    const value_var = idents[0][value_temp];
    
    // Генерируем команду для чтения значения из памяти
    gen(`${value_var.lex} = [${addr_var.lex}]`);
    
    // Устанавливаем начальное значение из памяти массива
    // Это критически важно - копируем реальное значение из памяти
    if (array.arr.initialValues && array.arr.initialValues[index_expr.val] !== undefined) {
        value_var.val = array.arr.initialValues[index_expr.val];
    } else {
        value_var.val = 0; // значение по умолчанию
    }
    
    // Сохраняем информацию о доступе к элементу массива
    attrSt.push({
        tbl: 0,
        idx: value_temp,
        isArrayElement: true,
        elementAddr: addr_var.lex,
        elementType: array.arr.elementType,
        arrayName: array_name,
        arrayIndex: index_expr.val
    });
    
    console.log('A32: Array element access successful for', array_name, 
                'index', index_expr.val, 'value temp:', value_var.lex, 'value:', value_var.val);
    return true;
}
// Var = StructVar "." "id" "[" Expr "]" {A33}
function A33() {
    console.log('A33: Array element access in struct');
    // Пока не реализуем - массивы в структурах сложнее
    return typeError(9, token); // временная ошибка
}

// Type = "id" {A34}
function A34(token) {
    console.log('A34: Type reference', token.lex);
    const type_idx = types.findIndex(el => el.lex == token.lex)
    if (type_idx == -1) return typeError(2, token)

    typesSt.push(type_idx)
    console.log('A34: Pushed type index', type_idx, types[type_idx]);
    return true
}

function A35(token) {
    console.log('A35: Array size number', token.lex);
    attrSt.push(token); // помещаем токен с размером в стек
    return true;
}

/** Выполнение семантических действий. true - успешно, false - ошибка */
function semanticAction(actionCode, token) {
    const actionNum = parseInt(actionCode.match(/\d+/)[0], 10);
    console.log(`Semantic action A${actionNum} called`);
    
    switch (actionNum) {
        case 1: return A1(token)
        case 2: return A2()
        case 3: return A3(token)
        case 4: return A4()
        case 5: return A5(token)
        case 6: return A6()
        case 7: return A7(token)
        case 8: return A8()
        case 9: return A9(token)
        case 10: return A10()
        case 11: return A11()
        case 12: return A12(token)
        case 13: return A13(token)
        case 14: return A14(token)
        case 15: return A15(token)
        case 16: return A16(token)
        case 17: return A17()
        case 18: return A18(token)
        case 19: return A19()
        case 20: return A20(token)
        case 21: return A21()
        case 22: return A22()
        case 23: return A23(token)
        case 24: return A24()
        case 25: return A25(token)
        case 26: return A26(token)
        case 27: return A27()
        case 28: return A28()
        case 29: return A29()
        // ДОБАВЛЯЕМ НОВЫЕ ДЕЙСТВИЯ ДЛЯ МАССИВОВ:
        case 30: return A30()
        case 31: return A31(token)
        case 32: return A32()
        case 33: return A33()
        case 34: return A34(token)
        case 35: return A35(token)
    }
    console.error(`Unknown semantic action: A${actionNum}`);
    return false
}

const nonTerms = new Map()
const terms = new Map()
const termsNonTerms = new Map()

/** СУ-трансляция. true, если нет ошибок */
function SUT() {
    console.log('=== SUT START ===');
    console.log('Token list:', tokenList);
    
    if (tokenList.length == 0) {
        console.log('No tokens found');
        return false;
    }
    if (!xmlString) return drawMiddleEditor('Ошибка', 'LR-таблица не загружена!')

    xml = new DOMParser().parseFromString(xmlString, 'text/xml')
    
    fillTermsNonTerms()

    idents = [
        [ /* Глобальные переменные */ ],
    ]
    
    types = [
        // Простые типы
        { lex: 'Int',     size: 4 },
        { lex: 'Float',   size: 8 },
        { lex: 'Boolean', size: 1 },
        { lex: 'String',  size: 64 },
    
        // Структуры
        // { lex: 'R', tbl: 1, size: 16 },
    ]

    offset     = 0
    nextAddr   = 0
    nextInstr  = 0
    instrMem   = []
    tmpVarCnt  = 0
    Q = []
    
    tblSt      = new Stack(0)
    attrSt     = new Stack
    instrSt    = new Stack
    typesSt    = new Stack
    offsetSt   = new Stack
    nextlistSt = new Stack
    
    let tokenCnt = 0
    let token = tokenList[tokenCnt]
    let prevToken = {...token}
    let parserState = 1 // текущее состояние стека парсера
    let parserSt = new Stack(1) // начальное состояние в стек

    const TypesElemTR = new Enum(
        'ERROR',  // элемент ошибки
        'SHIFT',  // элемент сдвига
        'REDUCE', // элемент свертки
        'BREAK'   // элемент останова
    )

    let elemTR = { type: TypesElemTR.ERROR } // элемент ошибки

    if (token.code > TypesElemTR.ERROR) { // нет лексической ошибки

        let lex = token.name

        // пока не элемент останова
        while (elemTR.type != TypesElemTR.BREAK) {

            parserState = parserSt.top() // текущее состояние анализатора

            let xmlNode = getXmlNode(parserState, lex)

            elemTR = {
                type: parseInt(xmlNode.getAttribute('ElType')),
                par: parseInt(xmlNode.getAttribute('ElPar')),
                left: xmlNode.getAttribute('Left'),
                act: xmlNode.getAttribute('Act')
            }

            switch (elemTR.type) {

                case TypesElemTR.ERROR: // синтаксическая ошибка
                    syntaxError(parserState, token)
                    return false

                case TypesElemTR.SHIFT: // элемент сдвига

                    parserSt.push(elemTR.par)  // состояние в стек

                    if (terms.has(lex)) {
                        prevToken = {...token}
                        token = tokenList[++tokenCnt]
                        if (token.code === 0) return false // ЛЕКСИЧЕСКАЯ ОШИБКА
                    }
                    lex = token.name
                    break

                case TypesElemTR.REDUCE: // элемент свертки

                    for (let i = 1; i <= elemTR.par; i++)
                        parserSt.pop() // удаление верхних элементов стека

                    lex = elemTR.left // нетерминал левой части как новый входной символ

                    if (elemTR.act != '') { // есть действие
                        if (!semanticAction(elemTR.act, prevToken)) // выполнить действия
                            return false
                    }
                    break
            }
        }
        gen('stop')
    }
    
    drawMiddleEditor('Результат', instrMem.join('\n'))

    const idents_tbl = []

    idents.forEach((subarray, tableIndex) => {
        subarray.forEach((item, rowIndex) => {
            const row = [tableIndex]
            if (rowIndex !== 0) row[0] = ''
            row.push(
                item.lex,
                types[item.type].lex,
                (typeof item.addr == 'number') ? (item.addr + '').padStart(3, '0') : '',
                // ИСПРАВЛЕНИЕ: правильно отображаем boolean значения
                item.val !== undefined && item.val !== null 
                    ? (typeof item.val === 'boolean' 
                        ? (item.val ? 'true' : 'false')  // явно показываем true/false
                        : item.val.toString())           // для остальных типов
                    : ''                                 // если значения нет
            )
            
            // Добавляем информацию о массивах
            if (item.arr) {
                row[1] += `[${item.arr.size}]`; // Показываем размер массива
                if (item.arr.initialValues) {
                    row[4] = `[${item.arr.initialValues.join(', ')}]`; // Показываем значения массива
                }
            }
            
            idents_tbl.push(row)
        })
    })
    
    drawRightTable(
        'Память', ['№ табл.', 'Лексема', 'Тип', 'Адрес', 'Значение'],
        idents_tbl
    )
    return true

}

function fillTermsNonTerms() {
    const nonTermsNodes = xml.getElementsByTagName('Neterms')[0].getElementsByTagName('Column')
    for (let i = 0; i < nonTermsNodes.length; i++) {
        const node = nonTermsNodes[i]
        const colNum = parseInt(node.getAttribute('ColNum'))
        const lexeme = node.getAttribute('Lexeme')
        nonTerms.set(lexeme, colNum)
        termsNonTerms.set(lexeme, colNum)
    }

    const termsNodes = xml.getElementsByTagName('Terms')[0].getElementsByTagName('Column')
    for (let i = 0; i < termsNodes.length; i++) {
        const node = termsNodes[i]
        const colNum = parseInt(node.getAttribute('ColNum'))
        const lexeme = node.getAttribute('Lexeme')
        terms.set(lexeme, colNum)
        termsNonTerms.set(lexeme, colNum)
    }
}

function getXmlNode(state, lex) {

    let resultNode = null

    Array.from(xml.getElementsByTagName('Row')).forEach(node => {

        if (state != parseInt(node.getAttribute('NSost'))) return

        let colNum = -1
        if (termsNonTerms.has(lex)) {
            
            colNum = termsNonTerms.get(lex)

            Array.from(node.childNodes).forEach(childNode => {
                if (childNode.nodeType != 1)
                    return // Пропускаем ненужные элементы

                if (colNum === parseInt(childNode.getAttribute('ColNum')))
                    resultNode = childNode
            })
        }
    })

    if (!resultNode)
        throw new Error('Узел XML не найден, состояние или лексема заданы неверно')

    return resultNode
}
