#!/usr/bin/env bash
# Extrai os .glb dos zips da Kenney (em assets-src/) para public/assets/kenney/
set -e
cd "$(dirname "$0")/.."
for z in assets-src/*.zip; do
  [ -e "$z" ] || { echo "Coloque os zips da Kenney em assets-src/"; exit 0; }
  n=$(basename "$z" | tr 'A-Z' 'a-z')
  case "$n" in
    *furniture*) d=furniture ;;
    *food*)      d=food ;;
    *character*) d=characters ;;
    *) echo "Ignorando $z"; continue ;;
  esac
  echo "-> $z => public/assets/kenney/$d"
  unzip -j -o "$z" "*.glb" -d "public/assets/kenney/$d" >/dev/null
done
echo "Pronto. Recarregue o jogo."
