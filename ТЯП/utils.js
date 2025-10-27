class Enum {
    constructor(...keys) {
        let i = 0
        for (let key of keys)
            this[key] = i++
        Object.freeze(this)
    }
    keyOf(value) {
        for (let key in this)
            if (this[key] === value)
                return key
        return null
    }
}

class Stack {
    constructor(initialItem = null) {
        this.items = []
        if (initialItem !== null) {
            this.push(initialItem)
        }
    }

    push(item) { this.items.push(item) }

    pop() {
        if (this.isEmpty()) return null
        return this.items.pop()
    }

    top() {
        if (this.isEmpty()) return null
        return this.items[this.items.length - 1]
    }

    isEmpty() { return this.items.length === 0 }

    size() { return this.items.length }

    clear() { this.items = [] }
}

function coordsByIndex(index, buffer) {
    const lines = buffer.join('').split(
        (settings.newline === 'crlf') ? '\r\n' : '\n'
    )
    let totalLength = 0
    let line = 0
    const newlineLength = (settings.newline === 'crlf') ? 2 : 1
    while (totalLength + lines[line].length <= index) {
        totalLength += lines[line].length + newlineLength
        line++
    }
    const character = index - totalLength
    return { line: line + 1, ch: character + 1 }
}

function createTable(parentElement, tableId, columnNames) {

    const tableResponsiveDiv = document.createElement('div')
    tableResponsiveDiv.classList.add('table-responsive')

    const table = document.createElement('table')
    table.classList.add('table', 'table-bordered', 'table-sm', 'tbl')
    table.setAttribute("id", tableId)

    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')

    // Добавляем ячейки заголовка с названиями колонок
    for (const columnName of columnNames) {
        const headerCell = document.createElement('th')
        headerCell.classList.add('text-center')
        headerCell.textContent = columnName
        headerRow.appendChild(headerCell)
    }

    thead.appendChild(headerRow)
    table.appendChild(thead)
    tableResponsiveDiv.appendChild(table)
    parentElement.appendChild(tableResponsiveDiv)

    OverlayScrollbarsGlobal.OverlayScrollbars(table.parentElement, {})
}

/**
 * addRowsToTable('table-id', [
 *    ['A', 'B'], ['C', 'D']
 * ])
*/
function addRowsToTable(tableId, valuesArray) {

    const table = document.getElementById(tableId)

    if (!table) {
        console.error(`Таблица с ID "${tableId}" не найдена.`)
        return
    }

    // создаем новую строку для каждого элемента массива значений
    for (const values of valuesArray) {
        const newRow = table.insertRow()

        // создаем новую ячейку для каждого значения и добавляем ее в строку
        for (const value of values) {
            const newCell = newRow.insertCell()
            newCell.textContent = value
            newCell.classList.add('text-center')
        }
    }
}