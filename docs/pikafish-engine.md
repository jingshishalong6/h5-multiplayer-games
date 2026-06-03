# Pikafish Engine Setup

The chess "engine hint" feature talks to a server-side UCI engine.

If no engine is configured, the app falls back to the local advisor and the UI clearly says:

```text
普通本地提示：未检测到Pikafish，已回退
```

## Local Run

Set `PIKAFISH_PATH` to a Pikafish executable before starting the server:

```bash
PIKAFISH_PATH=/absolute/path/to/pikafish npm start
```

Optional extra engine arguments:

```bash
PIKAFISH_ARGS="arg1 arg2" PIKAFISH_PATH=/absolute/path/to/pikafish npm start
```

## Render/Railway

1. Download the official Pikafish release.
2. Extract the `.7z` archive locally.
3. Pick the Linux executable that matches the server CPU.
4. Put that executable somewhere the deployed service can access.
5. Set the environment variable `PIKAFISH_PATH` to that executable path.

The official release archive is large and is not committed to this repository.
