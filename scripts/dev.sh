#!/bin/bash
set -e

echo "=== Family Picnic Platform Dev Setup ==="

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Docker is required but not installed. Please install Docker first."
    exit 1
fi

# Check for Docker Compose
if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is required but not installed. Please install Docker Compose first."
    exit 1
fi

DOCKER_COMPOSE="docker compose"
if ! command -v $DOCKER_COMPOSE &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
fi

# Start PostgreSQL via Docker
echo "Starting PostgreSQL container..."
$DOCKER_COMPOSE up -d postgres

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Check if .env exists, if not create from example
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Please edit .env and fill in your secrets, then run this script again."
    echo "Press Enter to continue anyway, or Ctrl+C to exit..."
    read
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    npm install
fi

# Generate Prisma client
echo "Generating Prisma client..."
npm run db:generate

# Push schema to database
echo "Pushing schema to database..."
npm run db:push

# Seed database (optional - comment out if you don't want to seed)
echo "Seeding database with sample data..."
npm run db:seed || echo "Seed skipped or failed (this is normal if DATABASE_URL is not configured)"

# Start Next.js dev server
echo "Starting Next.js dev server..."
echo "The app will be available at http://localhost:3000"
npm run dev
