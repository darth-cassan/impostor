# Impostor (GitHub Pages)

Static, mobile-first web app for running an Impostor-style party round.

## How to use

1. Tap **Create Game**
2. Add participant names
3. Choose how many impostors
4. Tap **Start Game**
5. Pass the phone: each player swipes up to reveal their role, then taps **Next**
6. After the last player, tap **Begin**
7. When ready, tap **Reveal impostors**

## Deploy on GitHub Pages

1. Push this repo to GitHub
2. In GitHub: **Settings → Pages**
3. Set source to **Deploy from a branch**, choose `main` (or `master`) and `/ (root)`
4. Open the Pages URL

## Run locally

From this folder:

`python3 -m http.server 8000`

## Custom word list

- Put your list in `words.txt` (one word/phrase per line).
- Lines starting with `#` are ignored.
