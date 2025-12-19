// index.js

const templateText =
`prog Test;
var
real x, a, b, c;
real [3] array;
integer i;
string s;
bool m;
start
    x = 1.5;
    c = 3.14e-10;
    s = "aaaa";
    m = False;
    i = 0;

    repeat
        array[i] = c / (i + 1) * x + i;
        i = i + 1;
    until (i > 2 || i >= 100);

stop
endProg`.replace(/\t/g, '\t').replace(/\n/g, '\n');

let xmlString = tmpXmlString; // Убедитесь, что tmpXmlString определена и содержит XML таблицу

const leftEditor = CodeMirror.fromTextArea(document.getElementById('left-editor'), {
    lineNumbers: true,
    scrollbarStyle: 'overlay',
    lineSeparator: '\n'
});

let settings = {};

window.onload = () => {
    let LSSettings = localStorage.getItem('settings');
    if (!LSSettings) {
        LSSettings = setDefaultSettingsToLS({
            theme: 'system',
            newline: 'lf',
        });
    }
    settings = Object.assign({}, JSON.parse(LSSettings));
    applySettingsToForm();
    applySettings();
    leftEditor.setValue(templateText);

    fillTokenList(templateText);
    try {
        SUT();
    } catch (e) {
        console.error("Ошибка трансляции:", e);
        drawMiddleEditor('Ошибка', `Ошибка выполнения: ${e.message}`);
    }
};

let middleFieldset = document.getElementById('middle-fieldset');
let rightFieldset = document.getElementById('right-fieldset');

let middleEditor = createMiddleEditor();
let rightEditor = createRightEditor();

function createMiddleEditor () {
    return CodeMirror.fromTextArea(middleFieldset.lastElementChild, {
        lineWrapping: true,
        mode: null,
        scrollbarStyle: "overlay"
    });
}

function createRightEditor () {
    return CodeMirror.fromTextArea(rightFieldset.lastElementChild, {
        lineWrapping: true,
        mode: null,
        scrollbarStyle: "overlay"
    });
}

function middleEditorLegend(text) {
    middleFieldset.children[0].innerText = text;
}

function rightEditorLegend(text) {
    rightFieldset.children[0].innerText = text;
}

function drawMiddleEditor(legendName, data) {
    // если уже есть таблица
    if (document.querySelector('table')) {
        middleFieldset.lastElementChild.remove();
        middleEditor = createMiddleEditor();
        applyTheme(settings.theme);
    }
    middleEditorLegend(legendName);
    middleEditor.setValue(data);
}

function drawRightEditor(legendName, data) {
    // если уже есть таблица
    if (document.querySelector('table')) {
        rightFieldset.lastElementChild.remove();
        rightEditor = createRightEditor();
        applyTheme(settings.theme);
    }
    rightEditorLegend(legendName);
    rightEditor.setValue(data);
}

function drawMiddleTable(legendName, columnNames, data) {
    middleEditorLegend(legendName);
    middleFieldset.lastElementChild.remove();
    if (!document.getElementById('middle-tbl')) {
        createTable(middleFieldset, 'middle-tbl', columnNames);
        addRowsToTable('middle-tbl', data);
    }
}

function drawRightTable(legendName, columnNames, data) {
    rightEditorLegend(legendName);
    rightFieldset.lastElementChild.remove();
    if (!document.getElementById('right-tbl')) {
        createTable(rightFieldset, 'right-tbl', columnNames);
        addRowsToTable('right-tbl', data);
    }
}

document.getElementById('translate').addEventListener('click', () => {
    fillTokenList(leftEditor.getValue());
    try {
        SUT();
    } catch (e) {
        console.error("Ошибка трансляции:", e);
        drawMiddleEditor('Ошибка', `Ошибка выполнения: ${e.message}`);
    }
});

// Отображение позиции курсора
leftEditor.on('cursorActivity', () => {
    const cursor = leftEditor.getCursor();
    document.getElementById('line').innerText = cursor.line + 1;
    document.getElementById('column').innerText = cursor.ch + 1;
});

// ############################# Открытие файла ################################

let currentCodeFileName;
document.getElementById('code-input').addEventListener('change', function () {
    new bootstrap.Dropdown(document.getElementById('file-dropdown')).hide();
    const file = this.files[0];
    currentCodeFileName = file.name;
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        if (text) {
            leftEditor.setValue(text);
            fillTokenList(text);
            try {
                SUT();
            } catch (e) {
                console.error("Ошибка трансляции:", e);
                drawMiddleEditor('Ошибка', `Ошибка выполнения: ${e.message}`);
            }
        } else
            drawMiddleEditor('Ошибка!', 'Пустой файл!');

    };
    reader.readAsText(file);

});

let currentXmlFileName;
document.getElementById('xml-input').addEventListener('change', function () {
    new bootstrap.Dropdown(document.getElementById('file-dropdown')).hide();
    const file = this.files[0];
    currentXmlFileName = file.name;
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        if (text) {
            xmlString = text;
        } else
            drawMiddleEditor('Ошибка!', 'Пустой XML-файл!');
    };
    reader.readAsText(file);

});

// ############################ Цветовая Схема #################################

let prefersDark = matchMedia('(prefers-color-scheme: dark)');

prefersDark.addEventListener('change', () => {
    if (settings.theme === 'system')
        applyTheme('system');
});

function applyTheme(theme) {
    if (theme === 'system')
        theme = prefersDark.matches ? 'dark' : 'light';

    document.documentElement.className = theme;
    leftEditor?.setOption('theme', theme);
    middleEditor?.setOption('theme', theme);
    rightEditor?.setOption('theme', theme);
}

// ####################### Разделитель между редакторами #######################

const GUTTER_SIZE = 8;

const gutterStyle = dimension => ({
  'flex-basis': `${GUTTER_SIZE}px`,
});

const elementStyle = (dimension, size) => ({
  'flex-basis': `calc(${size}% - ${GUTTER_SIZE}px)`,
});

Split(['#left-fieldset', '#middle-fieldset', '#right-fieldset'], {
  sizes: [30, 25, 45],
  elementStyle,
  gutterStyle
});
