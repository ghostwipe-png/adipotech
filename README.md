# Adipotech Platform

A secure, high-performance media and advertisement platform built with Astro, deployed to Cloudflare. The platform uses a strictly decoupled, static-first architecture with progressive web app (PWA) capabilities and a multi-service backend.

## 🏗️ Architecture Overview

This is a **pnpm monorepo**. It separates the public-facing static site from the backend microservices.

- `apps/site`: The public-facing Astro static site (this is what we are deploying now).
- `packages/`: (Future) Shared TypeScript types and utilities for the backend services.
- `apps/*-service`: (Future) The eight independent Cloudflare Workers (Auth, Comments, Likes, Subscriptions, Donations, Entitlements, Policy, Notifications).

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js (v20 or v22 LTS)
- pnpm (`npm install -g pnpm`)
- ImageMagick (for generating PWA assets)

### Installation
From the monorepo root:
```bash

