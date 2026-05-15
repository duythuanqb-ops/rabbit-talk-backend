#!/bin/bash
for f in src/database/migrations/*.sql; do
  name=$(basename "$f")
  echo "====================="
  echo "$name"
  if mysql -s --skip-ssl -h "$DB_HOST" -P "$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_DATABASE" < "$f" 2>/dev/null; then
    echo "completed"
  else
    echo "failed"
    echo "====================="
    exit 1
  fi
  echo "====================="
done
