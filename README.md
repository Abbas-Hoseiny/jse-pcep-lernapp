# JSE + PCEP Lern-App

Selbstgebaute, rein statische Lern-App für zwei Einsteiger-Zertifizierungen:

- **JSE-40-01** — JavaScript Essentials 1 (OpenEDG JavaScript Institute)
- **PCEP-30-02** — Python Certified Entry-Level Programmer (OpenEDG Python Institute)

## Features

- 📖 Theorie in Deutsch, Code in Standard-Syntax
- 🃏 Lernkarteien (Spaced Repetition Light)
- 💻 Live-Code-Playground
  - JavaScript: direkt im Browser (native `new Function`)
  - Python: **Pyodide** (WASM, einmalig ~10 MB Download)
- ✅ Quizfragen mit Erklärungen
- 📝 Vollständige Prüfungssimulationen
  - JSE: 40 Fragen · 60 Min · 70 %
  - PCEP: 30 Fragen · 45 Min · 70 %
- 💾 Fortschritts-Tracking per `localStorage`
- 🌓 Dunkles Design, responsive, offline nutzbar

## Struktur

```
/
├── index.html           JSE Dashboard
├── modul-1.html ... modul-7.html  JSE-Module
├── pruefung.html        JSE-Prüfung
├── styles.css           Design-System
├── app.js               Logik (Sidebar, Quiz, Flashcards, Exam)
└── pcep/                Python-App (spiegelt dieselbe Struktur)
    ├── index.html
    ├── modul-1.html ... modul-7.html
    ├── pruefung.html
    ├── styles.css       (@import ../styles.css + Python-Theme)
    └── app.js           (mit Pyodide)
```

## Bedienung

- Leertaste: Lernkarte umdrehen
- ←/→: durch Karten navigieren
- Cmd/Ctrl+Enter im Playground: Code ausführen
- Tab im Playground: Einrückung

## Lokal nutzen

`index.html` im Browser öffnen. Fertig.

Für zuverlässiges `localStorage` empfiehlt sich eine gehostete Variante (z. B. GitHub Pages) — unter `file://` kann es passieren, dass der Fortschritt zwischen Sessions oder zwischen JS/Python verloren geht.
