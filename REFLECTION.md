# Project Aria - Real-time Crypto Analytics Platform

This project explored connecting to Binance Public API to get a stream of market data which we could then display in a real-time dashboard.

The project was built using the following tools:
- Express
- Websocket
- D3.js
- React
- Vite
- Docker

## Project Goals
1) Setup a backend that connects to Binance Public API to get a stream of market data
2) Setup a frontend that displays the market data in a real-time dashboard

## Reflection
- Used AI tooling to quickly get the project setup
- Broke down the goals into smaller pieces and iterated upon that one at a time
- AI quickly became a bottleneck on various optimisation and improvement ideas and required intervention to manually update code
- Tests encountered similar problems that AI didn't have the right context to update and fix cleanly
- Adjusting UI/UX required manual intervention
- Current assessment of AI is at a junior or early mid-level engineer. Requires more intervention when tasks approach optimisation and without losing context (making unnecessary/destructive changes)
- Removed bloat by refactoring to use more native and lightweight implementations such as websocket (native) and ws libraries
- Memoization is key in reducing re-rendering for components especially given updates were frequent with the data coming from the Websockets
- Total time spent on this project: 12 hours

## Improvements
- Store and retrieve available symbols from the source / database (eg. Binance APIs) to ensure we get the correct set of data that is available
- Integration of CI/CD pipeline such as Github Actions - running tests, building the app and deploying
- Integration of IaC to manage infrastructure such as Terraform and used within CI/CD pipeline
- Left out connection to DB as unnecessary in this project but would use ORM such as TypeORM
- Authn/Authz - would utilise best practices such as JWT and OAuth
