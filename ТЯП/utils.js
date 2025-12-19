// utils.js

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

// ИСПРАВЛЕНАЯ функция coordsByIndex
function coordsByIndex(index, buffer) {
    // Проверяем, является ли buffer массивом
    if (!Array.isArray(buffer)) {
        throw new Error('Buffer должен быть массивом символов');
    }

    // Проверяем, является ли index числом и не выходит ли он за границы
    if (typeof index !== 'number' || index < 0 || index > buffer.length) {
        throw new Error(`Индекс ${index} выходит за пределы буфера длиной ${buffer.length}`);
    }

    // Объединяем буфер в строку
    const bufferString = buffer.join('');
    // Определяем символ новой строки из настроек
    const newline = (settings.newline === 'crlf') ? '\r\n' : '\n';

    // Разбиваем строку на строки
    const lines = bufferString.split(newline);

    let totalLength = 0;
    let lineIndex = 0;
    const newlineLength = newline.length;

    // Ищем строку, в которой находится индекс
    while (lineIndex < lines.length) {
        const currentLineLength = lines[lineIndex].length;
        // Проверяем, находится ли индекс в текущей строке или на границе новой строки
        if (totalLength + currentLineLength >= index) {
            // Индекс находится в текущей строке
            const characterIndex = index - totalLength;
            return { line: lineIndex + 1, ch: characterIndex + 1 };
        }
        // Увеличиваем totalLength, включая длину символа новой строки
        totalLength += currentLineLength + newlineLength;
        lineIndex++;
    }

    // Если индекс равен длине строки, он указывает на конец последней строки
    if (index === bufferString.length) {
        // Возвращаем координаты конца последней строки
        // Это может быть спорным, но предположим, что это последний символ последней строки
        // Если строка заканчивается символом новой строки, то индекс указывает на следующую строку, столбец 1
        // Но если символ новой строки нет, то на последний символ
        // Для простоты, если index === bufferString.length, и последний символ не \n, то это последний символ последней строки
        // Если последний символ \n, то это начало следующей (не существующей) строки.
        // Проверим последний символ
        if (bufferString.length > 0 && bufferString[bufferString.length - 1] === (settings.newline === 'crlf' ? '\n' : '\n')) {
             // Последний символ - \n, значит, индекс указывает на начало следующей строки
             // Но lines.length уже учитывает эту строку (даже если она пустая)
             // Если bufferString заканчивается на \n, то split создаст пустую строку в конце.
             // lines[lines.length - 1] будет пустой строкой.
             // totalLength для этой строки будет равен длине предыдущей строки + newlineLength.
             // Поэтому, если index === bufferString.length, и bufferString.endsWith(newline), то координаты (lines.length, 1)
             // Но если bufferString НЕ заканчивается на \n, то координаты (lines.length, lines[lines.length-1].length + 1)
             // Текущий цикл не дойдет до этой итерации, если bufferString.endsWith(newline), так как totalLength превысит index.
             // Нужно обработать это после цикла.
             // Если мы дошли сюда, значит, index === bufferString.length, и он не был найден в цикле.
             // Это означает, что bufferString заканчивается на символ новой строки.
             // lines.length учитывает пустую строку после \n.
             // Поэтому строка - lines.length - 1 (предпоследняя, если последняя пустая), столбец - длина этой строки + 1 (где находится \n).
             // Или строка - lines.length, столбец 1.
             // Проще: строка - lines.length, столбец 1.
             // Однако, если buffer пустой, lines.length = 0.
             if (lines.length === 0) {
                 return { line: 1, ch: 1 }; // или { line: 0, ch: 0 }?
             }
             // Проверим, заканчивается ли строка на \n
             if (bufferString.endsWith(newline)) {
                 return { line: lines.length, ch: 1 }; // Индекс после \n
             } else {
                 // Это случай, когда index === bufferString.length, но строка не заканчивается на \n
                 // Тогда это конец последней строки
                 const lastLine = lines[lines.length - 1];
                 return { line: lines.length, ch: lastLine.length + 1 };
             }
        } else {
            // bufferString не заканчивается на \n, и index === bufferString.length
            // Это конец последней строки
            const lastLine = lines[lines.length - 1];
            return { line: lines.length, ch: lastLine.length + 1 };
        }
    }

    // Этот случай не должен сработать, если проверки выше корректны
    throw new Error(`Не удалось определить координаты для индекса ${index} в буфере длиной ${bufferString.length}`);
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
