#!/bin/sh
# Seed script: runs all TypeScript seed files using ts-node
echo "============================="
echo "Running DB seeds..."
echo "============================="

for f in src/database/seeds/*.ts; do
  name=$(basename "$f")
  echo "Running seed: $name"
  if npx ts-node -r tsconfig-paths/register "$f"; then
    echo "✅ $name completed"
  else
    echo "❌ $name failed"
    echo "============================="
    exit 1
  fi
  echo "============================="
done

echo "All seeds completed."
