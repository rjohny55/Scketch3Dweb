# Getting started with Scketch3Dweb

## Run with Docker

Install Docker Engine (or Docker Desktop), Docker Compose, and Node.js. The project uses Node.js 26.12.1.

```sh
node scripts/setup-local.mjs
docker compose up --build -d
```

The setup helper creates `.env` with a random controller token without printing it or overwriting existing settings. Never publish this file.

Open http://127.0.0.1:31880 and create the first administrator account. Select **EN** or **RU** in the interface; your choice is saved in the browser. Project and object names are not translated.

## Connect an AI assistant

1. Enable MCP access for the user as an administrator.
2. Create a personal MCP key in application settings.
3. Copy the connection configuration into your MCP client.
4. Keep the editor tab open while the assistant works.

The default Streamable HTTP endpoint is http://127.0.0.1:31881/mcp. Personal keys are scoped to their owner's editor sessions and can be revoked. Keep keys private. See [connection examples](docs/mcp) and the [MCP guide](docs/skills/scketch3dweb-mcp-skill/SKILL.md).

## Use a remote server

Both ports bind to loopback by default. From your computer, open an SSH tunnel:

```sh
ssh -L 31880:127.0.0.1:31880 -L 31881:127.0.0.1:31881 user@your-server
```

Then use the same localhost addresses. Do not expose the services publicly without HTTPS and access controls.

## Storage and maintenance

Projects and accounts persist in a Docker volume. Set `SCKETCH3DWEB_MODELS_VOLUME` in `.env` if you need a specific host folder for model files.

```sh
docker compose logs --tail=100
docker compose down
docker compose up --build -d
```

Stopping containers keeps their persistent data. Do not use `docker compose down --volumes` unless you intend to delete that data. Back up your projects before updating.

For development, supported formats, limitations, and license information, see [README.md](README.md).
