# WEB 3D ARENA

A small, single-player first-person browser game. Explore a three-story arena, collect energy cores, and find the exit. The scene is rendered with WebGL 2 without a third-party 3D engine.

---

# [LET'S PLAY](https://rfbkak37y3kiy.github.io/WEB-3D-ARENA/)


## Objective

1. Click **Play**.
2. Collect five blue energy cores by walking up to them. The cores are located on different floors.
3. Climb the stairs to the third floor and find the exit. It unlocks after you collect all the cores.

The first floor has a pool, and the third floor has an open roof. Orange flames serve as landmarks and do not cause damage. After completing the game, your completion time is displayed and the **Restart** button becomes available.

The top-left corner displays FPS, the current floor, and the number of cores collected. The minimap in the bottom-right corner shows your current floor:

| Symbol | Meaning |
| --- | --- |
| `@` | Player |
| `#` | Wall |
| `*` | Uncollected core |
| `<`, `>` | Stairs |
| `E` | Exit on the third floor |

## Controls

### Desktop

| Action | Controls |
| --- | --- |
| Move forward / backward | `W` / `S` or the up / down arrow keys |
| Move left / right | `A` / `D` or the left / right arrow keys |
| Look around | Mouse |
| Sprint | Hold `Shift` |
| Jump | `Space` |
| Pause and release the pointer | `Esc` |

After you click **Play**, the browser captures the mouse pointer. To resume after pausing, click **Continue**.

### Touchscreens

- Left virtual joystick — move.
- Drag on the right side of the screen — look around.
- Hold **Sprint** to run; tap **Jump** to jump and **Pause** to pause.

The **Fullscreen** button in the top-right corner toggles fullscreen mode, if supported by your browser.

## Run locally

You need a modern browser with JavaScript enabled and **WebGL 2** support, and an HTTP server for static files. On desktop, mouse pointer capture is required for controls. No project dependencies or build step are needed.

Clone the repository and change into its directory:

```sh
git clone https://github.com/RFbkak37y3kIY/WEB-3D-ARENA.git
cd WEB-3D-ARENA
```

From the project root, start a server using one of these options:

```sh
# Python 3
python -m http.server 8000 --bind 127.0.0.1
```

```sh
# Node.js and npm
npx --yes http-server . -a 127.0.0.1 -p 8000
```

On the first run, `npx` may download `http-server` from npm. Then open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) and click **Play**. Stop the server with `Ctrl+C`.

Do not open `index.html` directly using `file://`: the browser may block modules loaded from local files. The HTML references modules using relative paths, but the game bundle loads textures from paths starting with `/assets/`, so the HTTP server's root must be the project root. To publish under a subpath, for example on GitHub Pages at a URL like `/<repository-name>/`, configure the paths or server so `/assets/` points to this project's `assets` directory.

## Project structure

```text
WEB-3D-ARENA/
├── index.html                          # Markup, styles, and module loading
├── assets/
│   ├── arena-BrCqJNHp.js               # Game logic and GLSL shaders
│   ├── mobile-controls-CERcSp5f.js      # WebGL, touch controls, and fullscreen support
│   ├── Steel_C-CHQZxMJV.jpg            # Floor and stair texture
│   └── SKY-C31tPj8y.jpg                # Sky texture
├── README.md
└── LICENSE
```

JavaScript handles the map, collisions, movement, and game state. The GLSL fragment shader combines ray tracing for the arena geometry with ray marching for the cores and volumetric flames; walls are procedurally generated and the water is animated.

By default, the scene is rendered to a buffer at half horizontal resolution and scaled using nearest-neighbor filtering. The rendering settings panel is present in the markup but hidden and cannot be opened through the interface; the experimental exponential projection and its **Distortion K** setting are disabled.

This repository contains prebuilt JavaScript bundles, not the original build project: `package.json`, source modules, build scripts, and automated tests are not included. There is also no server, multiplayer, or saved progress; reloading the page starts a new game.

## Troubleshooting

- **WebGL 2 is unavailable** or a shader fails to compile: check that your browser supports WebGL 2 and hardware acceleration, update your browser or graphics driver, and reload the page.
- Modules or textures fail to load: make sure the server is running from the project root and that resources are accessible at `/assets/`. If a texture fails to load, the game displays a warning and uses a fallback color.
- Mouse capture fails: open the game in a separate tab and click **Play** again.
- If the **Play** button does not fit on screen, increase the window height or change the device orientation.

## License

[MIT](LICENSE).
