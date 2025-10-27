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
    ])

    try {
        printErrorWithPos(
        `Обнаружена семантическая ошибка typeError(${code}):\n`
        + (errorMessages.get(code) || 'Неизвестная ошибка'),
        token.posStart, buffer
    )
    } catch (error) {
        console.log()
    }
    
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

    idents[tbl].forEach(ident => {
        alignAddress(types[ident.type].size)
        newTbl.push({ ...ident, addr: nextAddr })
    })

    return idents.push(newTbl) - 1
}

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
    let idx = idents[tblSt.top()].findIndex(el => el.lex == token.lex)
    if (idx != -1) return typeError(1, token)

    idx = idents[tblSt.top()].push({ lex: token.lex }) - 1
    attrSt.push(idx)
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
    const type_idx = types.findIndex(el => el.lex == token.lex)
    if (type_idx == -1) return typeError(2, token)

    typesSt.push(type_idx)
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
    const { assign } = attrSt.pop()
    let { tbl: Var_tbl, idx: Var_idx } = attrSt.pop()

    const Var = idents[Var_tbl][Var_idx]
    const Expr = idents[Expr_tbl][Expr_idx]
    
    if (Var.type != Expr.type) return typeError(4, assign)

    Var.val = Expr.val

    if (Var_tbl == 0) {
        gen(Var.lex + ' = ' + Expr.lex)
    }
    else {
        let parent_lex = idents[0].find(el => el.tbl == Var_tbl).lex || ''
        gen(parent_lex + '.' + Var.lex + ' = ' + Expr.lex)
    }

    return true
}

// Stmt → if Expr { N ThenElse } {A11}
function A11() {
    const ThenElse_nextlist = nextlistSt.pop()
    const N_nextlist = nextlistSt.pop()
    
    backPatch(N_nextlist, nextInstr)
    
    const { tbl: Expr_tbl, idx: Expr_idx } = attrSt.pop()
    const Expr = idents[Expr_tbl][Expr_idx]
    
    gen('if ' + Expr.lex + ' goto ' + Q.shift())
    
    let sec_label = Q.shift()
    
    if (sec_label == 'undefined') 
        gen('else goto ' + sec_label)
    else
        gen('else goto ' + (nextInstr + 1))

    backPatch(ThenElse_nextlist, nextInstr)
    nextlistSt.push([nextInstr])
    return true
}

// Var → id {A12}
function A12(token) {
    const idx = idents[0].findIndex(el => el.lex == token.lex)
    if (idx == -1) return typeError(3, token)

    attrSt.push({ tbl: 0, idx: idx })
    return true
}

// Var → ClassVar . id {A13}
function A13(token) {
    const idx = idents[tblSt.top()].findIndex(el => el.lex == token.lex)
    if (idx == -1) return typeError(3, token)

    attrSt.push({ tbl: tblSt.pop(), idx: idx })
    return true
}

// ClassVar → id {A14}
function A14(token) {
    const idx = idents[0].findIndex(el => el.lex == token.lex)
    if (idx == -1) return typeError(3, token)

    tblSt.push(idents[0][idx].tbl)

    return true
}

// ClassVar → ClassVar1 . id {A15}
function A15(token) {
    const idx = idents[tblSt.top()].findIndex(el => el.lex == token.lex)
    if (idx == -1) return typeError(3, token)

    tblSt.push(idents[tblSt.pop()][idx].tbl)
    return true
}

// ThenElse → then : M LstStmt {A16}
function A16() {
    const M_instr = instrSt.pop()

    Q.push(M_instr)

    nextlistSt.push(merge([nextInstr], null))

    gen('goto ?')
    return true
}

// ThenElse → ThenElse else : M LstStmt {A17}
function A17() {
    const M_instr = instrSt.pop()
    const ThenElse1_nextlist = nextlistSt.pop()

    Q.push(M_instr)

    nextlistSt.push(merge(merge(ThenElse1_nextlist, [nextInstr]), null))

    gen('goto ?')
    return true
}

// Expr → SmpExpr1 {A19} rel SmpExpr2 {A20}
function A19(token) {
    attrSt.push(token)
    return true
}

function A20() {

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

    let rels = ['<', '<=', '>', '>=', '!=', '==']
    
    gen(`if ${SmpExpr1.lex} ${rels[rel.attr]} ${SmpExpr2.lex} goto ${nextInstr + 3}`)
    gen(idents[0][Expr].lex + ' = false')
    gen(`goto ${nextInstr + 2}`)
    gen(idents[0][Expr].lex + ' = true')
    return true
}

// SmpExpr → SmpExpr1 add {A21} Term {A22}
function A21(token) {
    attrSt.push(token)
    return true
}

function A22() {
    const { tbl: Term_tbl, idx: Term_idx } = attrSt.pop()
    const additOp = attrSt.pop()
    const { tbl: SmpExpr1_tbl, idx: SmpExpr1_idx } = attrSt.pop() 

    const Term = idents[Term_tbl][Term_idx]
    const SmpExpr1 = idents[SmpExpr1_tbl][SmpExpr1_idx]

    if (SmpExpr1.type != Term.type) return typeError(4, additOp)
    if (additOp.attr == 2 && SmpExpr1.type != Types.BOOL) return typeError(5, additOp)

    let Term_lex = Term.lex
    let SmpExpr1_lex = SmpExpr1.lex

    if (Term_tbl != 0 || SmpExpr1_tbl != 0) {
        if (Term_lex != 0) Term_lex =
            idents[0].find(el => el.tbl == Term_tbl).lex + '.' + Term.lex

        if (SmpExpr1_lex != 0) SmpExpr1_lex =
            idents[0].find(el => el.tbl == SmpExpr1_tbl).lex + '.' + SmpExpr1.lex
    }

    let val
    switch(additOp.attr) {
        case 0: val = SmpExpr1.val + Term.val; break
        case 1: val = SmpExpr1.val - Term.val; break
        case 2: val = SmpExpr1.val || Term.val; break
    }

    const SmpExpr_idx = newTemp(SmpExpr1.type, val)
    const SmpExpr = idents[0][SmpExpr_idx]

    const ops = ['+', '-', '||']
    gen(`${SmpExpr.lex} = ${SmpExpr1_lex} ${ops[additOp.attr]} ${Term_lex}`)
    
    attrSt.push({ tbl: 0, idx: SmpExpr_idx })
    return true
}

// Term → Term1 mul {A23} Factor {A24}
function A23(token) {
    attrSt.push(token)
    return true
}

function A24() {
    const { tbl: Factor_tbl, idx: Factor_idx } = attrSt.pop()
    const multOp = attrSt.pop()
    const { tbl: Term1_tbl, idx: Term1_idx } = attrSt.pop()

    const Term1 = idents[Term1_tbl][Term1_idx]
    const Factor = idents[Factor_tbl][Factor_idx]

    if (Term1.type != Factor.type) return typeError(4, multOp)
    if (multOp.attr == 3 && Term1.type != Types.BOOL) return typeError(5, multOp)

    let Term1_lex = Term1.lex
    let Factor_lex = Factor.lex

    if (Term1_tbl != 0 || SmpExpr1_tbl != 0) {
        if (Term1_lex != 0) Term1_lex =
            idents[0].find(el => el.tbl == Term1_tbl).lex + '.' + Term1.lex

        if (Factor_lex != 0) Factor_lex =
            idents[0].find(el => el.tbl == Factor_tbl).lex + '.' + Factor.lex
    }
    
    let val
    switch(multOp.attr) {
        case 0: val = Term1.val * Factor.val; break
        case 1: val = Term1.val / Factor.val; break
        case 2: val = Term1.val % Factor.val; break
        case 3: val = Term1.val && Factor.val; break
    }

    const Term_idx = newTemp(Term1.type, parseFloat(val.toFixed(2)))
    const Term = idents[0][Term_idx]

    const ops = ['*', '/', '%', '&&']
    gen(`${Term.lex} = ${Term1_lex} ${ops[multOp.attr]} ${Factor_lex}`)
    
    attrSt.push({ tbl: 0, idx: Term_idx })
    return true
}

// Factor → Const {A25}
function A25() {
    const { type, val } = attrSt.pop()

    const idx = newTemp(type, val)
    const id = idents[0][idx]
    
    let lex = (type == Types.STR) ? '"' + val + '"' : val
    gen(`${id.lex} = ${lex}`)

    attrSt.push({ tbl: 0, idx: idx })
    return true
}

// Factor → ! {A26} Factor1 {A27}
function A26(token) {
    attrSt.push(token)
    return true
}

function A27() {
    const Factor1_idx = attrSt.pop()
    const not = attrSt.pop()

    const Factor1 = idents[Factor1_idx.tbl][Factor1_idx.idx]
    if (Factor1.type != Types.BOOL) return typeError(5, not)

    const Factor_idx = newTemp(Types.BOOL, !Factor1_idx.val)
    const Factor = idents[0][Factor_idx]

    gen(`${Factor.lex} = not ${Factor1.lex}`)
    
    attrSt.push({tbl: 0, idx: Factor_idx})
    return true
}

// Const → num {A28}
function A28(token) {
    let type
    switch (token.attr) {
        case 0: type = Types.INT; break
        case 1: type = Types.FLOAT; break
        case 2: type = Types.FLOAT; break
    }
    attrSt.push({type: type, val: token.lex})
    return true
}

// Const → str {A29}
function A29(token) {
    attrSt.push({type: Types.STR, val: token.lex})
    return true
}

// Сonst → true {A30}
function A30() {
    attrSt.push({type: Types.BOOL, val: true})
    return true
}

// Сonst → false {A31}
function A31() {
    attrSt.push({type: Types.BOOL, val: false})
    return true
}

// M → ε {A32}
function A32() {
    instrSt.push(nextInstr)
    return true
}

// N → ε {A33}
function A33() {
    nextlistSt.push([nextInstr])
    gen('goto ?')
    Q = []
    return true
}

/** Выполнение семантических действий. true - успешно, false - ошибка */
function semanticAction(actionCode, token) {
    switch (parseInt(actionCode.match(/\d+/)[0], 10)) {
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
        case 16: return A16()
        case 17: return A17()
        case 19: return A19(token)
        case 20: return A20()
        case 21: return A21(token)
        case 22: return A22()
        case 23: return A23(token)
        case 24: return A24()
        case 25: return A25()
        case 26: return A26(token)
        case 27: return A27()
        case 28: return A28(token)
        case 29: return A29(token)
        case 30: return A30()
        case 31: return A31()
        case 32: return A32()
        case 33: return A33()
    }
    return false
}

const nonTerms = new Map()
const terms = new Map()
const termsNonTerms = new Map()

/** СУ-трансляция. true, если нет ошибок */
function SUT() {

    if (tokenList.length == 0) return false
    if (!xmlString) return drawMiddleEditor('Ошибка', 'LR-таблица не загружена!')

    xml = new DOMParser().parseFromString(xmlString, 'text/xml')
    
    fillTermsNonTerms()

    idents = [
        [ /* Глобальные переменные */ ],
    ]
    
    types = [
        // Простые типы
        { lex: 'int',   size: 4 },
        { lex: 'float', size: 8 },
        { lex: 'bool',  size: 1 },
        { lex: 'str',   size: 64 },
    
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

            let val = item.val

            if (typeof item.val == 'undefined')
                val = ''

            row.push(
                item.lex,
                types[item.type].lex,
                (typeof item.addr == 'undefined') ? '' : (item.addr + '').padStart(3, '0'),
                val
            )
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