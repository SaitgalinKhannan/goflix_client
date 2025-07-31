# Goflix

Netflix-like streaming service powered by torrents. Download and stream movies directly through your browser.

## Features

- 🎬 **Torrent Integration** - Add movies via magnet links
- 📁 **File Browser** - Navigate and explore downloaded content
- 📊 **Real-time Progress** - Live download status via WebSocket
- 🎯 **Simple UI** - Clean, responsive interface

## Tech Stack

- **Frontend**: SvelteKit + TypeScript
- **Backend**: Go server (separate repository)
- **Real-time**: WebSocket connections

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Make sure your Go backend is running on `localhost:8080`

## Usage

1. **Add Torrents** - Paste magnet links on the `/torrent` page
2. **Monitor Downloads** - Watch real-time progress updates
3. **Browse Files** - Navigate downloaded content on the `/files` page
4. **Stream Content** - Play your downloaded movies

*Built for only*