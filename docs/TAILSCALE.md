# Termfleet with Tailscale

This deployment configuration runs Termfleet with Tailscale as a sidecar container, making it accessible through your private Tailnet.

## Architecture

```
┌─────────────────────────────────────┐
│  termfleet-ts (Tailscale Sidecar)  │
│  - Connects to Tailnet              │
│  - Exposes HTTPS on port 443        │
│  - hostname: termfleet              │
│  - Network namespace shared         │
└─────────────────┬───────────────────┘
                  │
                  │ network_mode: service:termfleet-ts
                  │ (shares network stack)
                  │
┌─────────────────▼───────────────────┐
│  termfleet (Application)            │
│  - Express API + React Frontend     │
│  - Listens on localhost:8080        │
│  - No direct network exposure       │
└─────────────────────────────────────┘
```

## Benefits

✅ **Zero-trust access** - Only accessible via your private Tailnet  
✅ **Automatic HTTPS** - Tailscale provides certificates  
✅ **No port forwarding** - Works through NAT/firewalls  
✅ **Simple authentication** - Uses Tailscale identity  
✅ **Encrypted traffic** - WireGuard protocol

## Setup

### 1. Get Tailscale Auth Key

1. Go to https://login.tailscale.com/admin/settings/keys
2. Generate a new auth key with:
   - ✅ Reusable (recommended for containers)
   - ✅ Ephemeral (optional - removes device when container stops)
   - ✅ Tags: `tag:container`

### 2. Configure Environment

```bash
cp .env.example .env
nano .env
```

Add your Tailscale auth key:
```env
TS_AUTHKEY=tskey-auth-xxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Also configure your Termfleet settings (Spaceship API credentials, etc.)

### 3. Start Services

```bash
docker compose up -d
```

### 4. Access Termfleet

The service will be accessible at:
```
https://termfleet.your-tailnet.ts.net
```

Replace `your-tailnet` with your actual Tailnet name.

## How It Works

### Network Sharing

The `network_mode: service:termfleet-ts` setting makes the Termfleet container share the Tailscale container's network namespace. This means:

- Termfleet listens on `localhost:8080` (inside the shared network)
- Tailscale proxies external requests to `http://127.0.0.1:8080`
- No ports are exposed on the host machine
- Only accessible through the Tailnet

### Tailscale Serve Configuration

The `ts-config/termfleet.json` file configures Tailscale Serve:

```json
{
  "TCP": {
    "443": {
      "HTTPS": true
    }
  },
  "Web": {
    "${TS_CERT_DOMAIN}:443": {
      "Handlers": {
        "/": {
          "Proxy": "http://127.0.0.1:8080"
        }
      }
    }
  }
}
```

This tells Tailscale to:
1. Listen on HTTPS port 443
2. Proxy all requests to the Termfleet application
3. Use Tailscale-provided certificates

## Management

### View Logs

```bash
# All services
docker compose logs -f

# Termfleet only
docker compose logs -f termfleet

# Tailscale only
docker compose logs -f termfleet-ts
```

### Check Tailscale Status

```bash
docker compose exec termfleet-ts tailscale status
```

### Restart Services

```bash
docker compose restart
```

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose up -d --build
```

## Troubleshooting

### Container can't connect to Tailnet

1. Check auth key is valid:
   ```bash
   docker compose logs termfleet-ts | grep -i auth
   ```

2. Verify the auth key has `tag:container` permission

3. Check ACLs allow the container tag to access the network

### Can't access service

1. Verify Tailscale is connected:
   ```bash
   docker compose exec termfleet-ts tailscale status
   ```

2. Check the hostname:
   ```bash
   docker compose exec termfleet-ts tailscale status | grep termfleet
   ```

3. Test locally first:
   ```bash
   docker compose exec termfleet-ts curl http://localhost:8080/health
   ```

### Health check failing

```bash
# Check if app is running
docker compose exec termfleet-ts curl http://localhost:8080/health

# View app logs
docker compose logs termfleet
```

## Security Considerations

### Best Practices

1. **Use ephemeral auth keys** for automatic cleanup
2. **Tag containers** properly (`tag:container`) for ACL management
3. **Restrict ACLs** to only allow necessary access
4. **Rotate auth keys** periodically
5. **Monitor access** through Tailscale admin console

### ACL Example

```jsonc
{
  "tagOwners": {
    "tag:container": ["autogroup:admin"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["group:developers"],
      "dst": ["tag:container:443"]
    }
  ]
}
```

## Alternative: Standalone Deployment

If you don't want to use Tailscale, check `docs/DEPLOYMENT.md` for:
- Traditional deployment (Node.js + Caddy)
- Docker deployment without Tailscale
- Public internet deployment options

## Reference

- [Tailscale in Docker](https://tailscale.com/kb/1282/docker/)
- [Tailscale Serve](https://tailscale.com/kb/1312/serve/)
- [Tailscale ACLs](https://tailscale.com/kb/1018/acls/)
