# Project Aria Frontend

A real-time crypto market data dashboard built with React, Vite, and Socket.IO.

## Environment Variables

Copy `.env.example` to create your own `.env` file:

```bash
cp .env.example .env
```

Available environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| VITE_WEBSOCKET_URL | WebSocket server URL | http://localhost:3001 |

## Development

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The application will be available at http://localhost:3002.

## Building for Production

```bash
npm run build
```

This will create a production build in the `dist` directory.

## Features

- Real-time market data updates via WebSocket
- Subscribe to multiple crypto symbols
- Clean, modern UI with Tailwind CSS
- Error handling and loading states
