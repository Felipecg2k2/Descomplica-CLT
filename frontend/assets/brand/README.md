# Identidade Visual — Descomplica CLT

Esta pasta centraliza os ativos visuais oficiais do **Descomplica CLT**.

## Como aplicar a logo oficial posteriormente
1. Adicione o arquivo oficial da logo nesta pasta (por exemplo, `logo-descomplica-clt.png` ou `logo-descomplica-clt.svg`).
2. Abra o arquivo `frontend/assets/brand/brandConfig.js`.
3. Altere `useImageLogo: false` para `useImageLogo: true` e confirme o caminho em `logoUrl`.

A logo será aplicada automaticamente nos cabeçalhos do Totem, tela inicial, tela de login e menu lateral administrativo.

## Como aplicar as cores oficiais posteriormente
Edite exclusivamente as variáveis CSS em `frontend/css/variables.css`.
