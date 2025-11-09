
# AI Agent Skeleton

A production-minded Microsoft Teams app skeleton including **Tab**, **Bot**, **Message Extension**, **Backend API**, **Graph integration**, and **OAuth**.

## Quick Start

```bash
# 1) Install dependencies
pnpm i   # or npm i / yarn

# 2) Copy env
cp .env.example .env  # fill Azure AD + Bot credentials

# 3) Run dev
pnpm dev

# 4) Expose HTTPS for Teams callbacks
# Use Teams Toolkit Dev Tunnels OR ngrok/localtunnel:
npx localtunnel --port 3978
# Replace https://localhost:3978 in manifest/manifest.json with your HTTPS domain

# 5) Package and upload to Teams admin
pnpm zip:manifest
# Upload the generated ai-teams-agent.zip
```
