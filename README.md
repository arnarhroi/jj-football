# JJ Football ⚽

A swipe-to-shoot football game for mobile phones, built as an installable web app (PWA).
No build step and no dependencies: plain HTML, CSS and JavaScript modules drawing to a canvas.

## Game modes

| Mode | What you do |
| --- | --- |
| **Practice** | Shoot freely from the penalty spot, the edge of the box or a free-kick position with a wall. Choose no keeper or an Easy, Medium or Hard keeper. |
| **Penalty Cup** | Pick a nation and win a quarter-final, semi-final and final, each decided by a penalty shoot-out. You take your team's penalties and also play in goal for the other side's kicks. Difficulty: Amateur, Pro or World Class. |
| **Target Challenge** | 60 seconds to hit as many targets as you can. Hitting targets in a row builds a combo, and each target hit adds 2 seconds. |
| **Crossbar Challenge** | 10 balls. Hitting the bar is worth 3 points and a post is worth 1. |
| **Free Kick Challenge** | 10 free kicks against a wall and a keeper. Top-corner goals score double. |

Best scores and cups won are saved on the device.

## Controls

- **Shoot:** swipe from the ball towards the spot you want to hit. A short swipe keeps the shot low and a long swipe sends it high.
- **Power:** a faster swipe gives a harder shot. Hit it too hard and it can fly over the bar.
- **Curl:** curve your swipe to bend the ball, for example around the wall.
- **Goalkeeping (Penalty Cup):** tap the spot in the goal where you want to dive. You can tap early to guess or tap after the kick to react.

## Run it locally

Any static file server works:

```sh
python3 -m http.server 8000
# open http://localhost:8000 on your computer, or http://<your-computer-ip>:8000 on your phone
```

To install it on a phone, host the folder over HTTPS (GitHub Pages, Netlify and similar hosts work). Then use **Add to Home Screen** in Safari or **Install app** in Chrome. Once installed, the game runs full screen and works offline.

## Code layout

```
index.html            screens and HUD markup
css/style.css         mobile-first UI styles
js/world.js           physics: ball flight, drag, curl, bounces, goal frame and net, keeper, wall, shot solver
js/render.js          canvas renderer: perspective camera, stadium, pitch, players, ball
js/game.js            game loop, swipe input, shot and save logic, effects
js/modes.js           Practice, challenges, Penalty Cup bracket and shoot-out rules
js/audio.js           synthesised sound effects (Web Audio, no audio files)
js/main.js            menus, settings, saved records
sw.js                 service worker for offline play
manifest.webmanifest  PWA manifest
```

## Deploy to Fly.io

`fly.toml` serves the game with a stock nginx image. Fly copies the game files into the machine, so no Docker build is needed.

```sh
fly launch --no-deploy --copy-config --name <your-app-name>   # once; skip if the app already exists
fly deploy
```

The game is then live at `https://<your-app-name>.fly.dev`. If you add a new file to the game, also list it under `[[files]]` in `fly.toml`.

### Automatic deploys with GitHub Actions

`.github/workflows/fly-deploy.yml` deploys the game on every push to `main`. You can also run it by hand from the **Actions** tab.

One-time setup:

1. Create a Fly token. For the first deploy, the token must be able to create the app, so use an org token: `fly tokens create org`. After the app exists, an app-only token is enough: `fly tokens create deploy -a jj-football`.
2. In GitHub, go to **Settings → Secrets and variables → Actions** and add a repository secret named `FLY_API_TOKEN` containing the whole token, including the `FlyV1` prefix.
3. Optional: if your Fly organisation isn't `personal`, add a repository variable named `FLY_ORG` with its slug.
