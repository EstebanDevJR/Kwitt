#!/bin/bash

# Kwitt Setup Script

echo "🚀 Configurando Kwitt..."

# Install root dependencies
echo "📦 Instalando dependencias del proyecto..."
npm install

# Install backend dependencies
echo "📦 Instalando dependencias del backend..."
cd backend && npm install && cd ..

# Install frontend dependencies
echo "📦 Instalando dependencias del frontend..."
cd frontend && npm install && cd ..

# Install bot dependencies
echo "📦 Instalando dependencias del bot..."
cd bot && npm install && cd ..

# Copy environment file
echo "📝 Configurando variables de entorno..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Edita el archivo .env con tus credenciales"
fi

echo ""
echo "✅ Setup completado!"
echo ""
echo "Para iniciar:"
echo "  Backend:  cd backend && npm run dev"
echo "  Frontend: cd frontend && npm run dev"
echo "  Bot:       cd bot && npm run dev"
echo ""
echo "O usa Docker:"
echo "  docker-compose up"