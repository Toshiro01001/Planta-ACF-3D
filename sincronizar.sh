#!/bin/bash
# sincronizar.sh · mantém UMA só cópia do código comum entre os dois sites da Planta da Caixa.
# A fonte da verdade é o repositório 2.5D (Planta-ACF). O repositório 3D (Planta-ACF-3D) recebe cópias idênticas.
# Lista dos arquivos comuns: compartilhado.txt. O index.html NÃO é comum (cada site carrega seus scripts).
# Uso (com as duas pastas lado a lado):
#   ./sincronizar.sh conferir   mostra o que difere, sem copiar (sai com erro se algo difere)
#   ./sincronizar.sh copiar     copia os comuns do 2.5D para o 3D
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"; DEST="${DEST3D:-$AQUI/../Planta-ACF-3D}"
[ -d "$DEST" ] || { echo "Pasta do site 3D não encontrada: $DEST (use DEST3D=caminho)"; exit 2; }
dif=0
while read -r f; do
  [ -z "$f" ] && continue
  if [ ! -f "$DEST/$f" ] || ! cmp -s "$AQUI/$f" "$DEST/$f"; then
    dif=$((dif+1)); echo "difere: $f"
    [ "$1" = "copiar" ] && cp "$AQUI/$f" "$DEST/$f"
  fi
done < "$AQUI/compartilhado.txt"
cp "$AQUI/compartilhado.txt" "$DEST/compartilhado.txt" 2>/dev/null || true
[ "$dif" -eq 0 ] && echo "Tudo igual nos dois sites." || { [ "$1" = "copiar" ] && echo "$dif arquivo(s) copiado(s)." || { echo "$dif arquivo(s) diferente(s)."; exit 1; }; }
