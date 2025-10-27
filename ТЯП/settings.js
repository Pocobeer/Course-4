function setDefaultSettingsToLS(defaultSettings) {
    // Получаем текущие настройки из LocalStorage (если они есть)
    const currentSettings = JSON.parse(localStorage.getItem('settings')) || {}

    // Объединяем значения по умолчанию с текущими настройками
    const updatedSettings = { ...defaultSettings, ...currentSettings }

    // Сохраняем обновленные настройки в LocalStorage
    localStorage.setItem('settings', JSON.stringify(updatedSettings))

    return updatedSettings
}

function applySettingsToForm() {

    document.getElementsByName('theme').forEach(radio => {
        if (radio.value === settings.theme)
            radio.checked = true
    })

    document.getElementsByName('newline').forEach(radio => {
        if (radio.value === settings.newline)
            radio.checked = true
    })
}

function saveSettingsFromForm() {
    settings.theme = Array.from(document.getElementsByName('theme'))
        .find(radio => radio.checked)?.value || ''

    settings.newline = Array.from(document.getElementsByName('newline'))
        .find(radio => radio.checked)?.value || ''

    localStorage.setItem('settings', JSON.stringify(settings))
}

function applySettings() {
    applyTheme(settings.theme)
    leftEditor.setOption('lineSeparator',
        (settings.newline === 'crlf') ? '\r\n' : '\n'
    )
}

document.getElementById('save-settings').addEventListener('click', () => {    
    saveSettingsFromForm()
    applySettings()
})