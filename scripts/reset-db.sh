#!/bin/bash

# Reset the development database and reapply migrations.
# This is meant for local/dev use only.

if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_DATABASE" ]; then
  echo "Missing DB environment variables."
  echo "Please set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE."
  exit 1
fi

echo "Dropping database $DB_DATABASE..."
if ! mysql -s --skip-ssl -h "$DB_HOST" -P "$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "DROP DATABASE IF EXISTS $DB_DATABASE"; then
  echo "Failed to drop database $DB_DATABASE"
  exit 1
fi

echo "Recreating database $DB_DATABASE..."
if ! mysql -s --skip-ssl -h "$DB_HOST" -P "$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE $DB_DATABASE"; then
  echo "Failed to create database $DB_DATABASE"
  exit 1
fi

echo "Running migrations..."
bash scripts/migrate.sh
