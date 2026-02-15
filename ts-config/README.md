# Tailscale Configuration

This directory contains the Tailscale Serve configuration for exposing the Termfleet application through your Tailnet.

## Files

- `termfleet.json` - Tailscale Serve configuration that proxies HTTPS traffic to the Termfleet container

## Configuration

The `termfleet.json` file configures Tailscale to:
- Listen on port 443 with HTTPS enabled
- Proxy all requests to `http://127.0.0.1:8080` (the Termfleet application)
- Use your Tailscale-provided HTTPS certificate

## Usage

When running with docker-compose, this configuration is automatically loaded through the `TS_SERVE_CONFIG` environment variable.

The Termfleet service shares the network namespace with the Tailscale sidecar container (`network_mode: service:termfleet-ts`), making the service accessible via your Tailnet.

## Requirements

- Set `TS_AUTHKEY` in your `.env` file
- Get auth keys from: https://login.tailscale.com/admin/settings/keys
- Ensure the auth key has the `tag:container` tag authorized
