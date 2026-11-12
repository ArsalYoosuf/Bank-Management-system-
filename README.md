# Bank Management System

A small bank management project with two interfaces:

- **Web dashboard** (`app.py`) — Flask + vanilla HTML/CSS/JS
- **Command line app** (`main.py`) — the original terminal menu

Both use the same `bank.py` model (`Bank` → `AccountHolder` → `Account`).
Data is kept in memory for each process, so it resets when the app stops.

## Setup

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Run the web dashboard

```powershell
python app.py
```

Open <http://127.0.0.1:5000> in your browser.

## Run the command line app

```powershell
python main.py
```

## Project layout

```
app.py               Flask app + JSON API
main.py              CLI menu
bank.py              Bank / AccountHolder / Account model
templates/index.html Dashboard markup
static/styles.css    Dashboard styles
static/app.js        Dashboard logic
static/favicon.svg   Browser icon
```
