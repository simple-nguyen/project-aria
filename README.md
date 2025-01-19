# Project Aria - Real-time Crypto Analytics Platform

A modern full-stack application for real-time cryptocurrency market analysis and visualization. Built with React, TypeScript, and WebSocket integration.

## Features

- Real-time cryptocurrency market data visualization using D3.js
- WebSocket integration for live data updates
- Interactive dashboards for market analysis
- High-performance data handling and visualization
- Dockerized development environment

## Tech Stack

- **Frontend**: React, Vite, TypeScript, D3.js
- **Backend**: Node.js, Express, TypeScript, WebSocket
- **Infrastructure**: Docker, Docker Compose

## Prerequisites

- Docker and Docker Compose
- Node.js (v20 or later)
- npm (v9 or later)

## Getting Started

1. Clone the repository:
```bash
git clone [repository-url]
cd project-aria
```

2. Install dependencies:
```bash
npm install
```

3. Start the development environment:
```bash
docker-compose up
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- WebSocket: ws://localhost:4001

## Project Structure

```
project-aria/
├── src/
│   ├── frontend/    # React frontend
│   ├── backend/     # Express backend server
│   └── shared/      # Shared types and utilities
├── docker/          # Dockerfile definitions
└── docker-compose.yml
```

## Development

- Frontend development server: `npm run dev:frontend`
- Backend development server: `npm run dev:backend`
- Run both simultaneously: `npm run dev`
- Run using docker: `npm run dev:docker`

## Building for Production

```bash
npm run build
```

## Testing

```bash
npm test
```
