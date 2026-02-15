# AUSS - Full Stack Application

A modern full-stack web application built with Node.js/Express backend, React frontend with Vite, Prisma ORM, and PostgreSQL database.

## Tech Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **Prisma** - ORM for database operations
- **PostgreSQL** - Database (via Docker)

### Frontend
- **React** - UI library
- **Vite** - Fast build tool
- **JavaScript** - Programming language

## Project Structure

```
AUSS/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── index.js
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Docker and Docker Compose (for PostgreSQL)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AUSS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration (database credentials, API URLs, etc.)

4. **Start PostgreSQL database**
   ```bash
   docker compose up -d
   ```

5. **Set up Prisma**
   ```bash
   cd backend
   npx prisma generate
   npx prisma migrate dev --name init
   cd ..
   ```

## Development

### Run Backend (Terminal 1)
```bash
npm run server
```
Backend runs on `http://localhost:5000`

### Run Frontend (Terminal 2)
```bash
npm start
```
Frontend runs on `http://localhost:3000`

### Database Management
- **View data with Prisma Studio**
  ```bash
  cd backend
  npm run prisma:studio
  ```

- **Create a new migration**
  ```bash
  cd backend
   npx prisma migrate dev --name init
  ```

### Stop Services
```bash
# Stop Docker database
docker compose down
```

## Environment Variables

See `.env.example` for all available configuration options:

- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment (development/production)
- `PORT` - Backend server port (default: 5000)
- `REACT_APP_API_URL` - Backend API URL for frontend (default: http://localhost:5000)

## API Integration

The frontend is configured to proxy API requests to the backend. Import the API utility:

```javascript
import { fetchFromAPI } from './services/api';

// Usage
const data = await fetchFromAPI('/endpoint');
```

## License

MIT - See LICENSE file for details

## Author

ProjectAuss2026