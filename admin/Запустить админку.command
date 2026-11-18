#!/bin/bash
# Двойной клик — запускает админку портфолио и открывает её в браузере
cd "$(dirname "$0")/.." || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
python3 admin/server.py
