# Botões da HUD mobile premium (15/10/2026)

Arte do dono, entregue pelo Google Drive da pasta do pacote "HUD Mobile Premium", com o rótulo
desenhado dentro da imagem ("Caçar", "Voltar", "Auto · ON", "Auto · OFF").

- `original-*.webp`: as quatro imagens como chegaram, reduzidas a 640 px (os PNG originais têm
  1–1,5 MB cada).
- `medalhao.py`: o recorte usado. No jogo o rótulo fica como TEXTO de verdade (o ON/OFF muda com o
  estado, o jogo tem modo em inglês e o leitor de tela lê o texto), então só o medalhão é usado: a
  pílula sai e o pedaço do disco que ela cobria é reconstruído espelhando o disco pelo centro, com
  uma transição de 16 linhas na emenda. A saída é um quadrado de 256 px centrado no disco (o disco
  ocupa ~91% do lado).

Publicados em `public/ragidle/hud/premium/botao-{auto-on,auto-off,cacar,voltar}.webp`.

Para refazer a partir de um PNG novo:

```
python3 -I arte-fonte/ui-icons-premium/botoes/medalhao.py <original.png> public/ragidle/hud/premium/botao-<nome>.webp
```
