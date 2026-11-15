# O Santuário do Eremita Literário

Tracker de leitura estático com estética de biblioteca clássica, feito somente
com HTML, CSS e JavaScript. As abas separam o painel, a estante, os check-ins,
o cadastro de livros e o arquivo de cópias.

## Publicar como HTML no GitHub Pages

Não há Python, dependências ou etapa de build. Para publicar, abra
**Settings → Pages** no GitHub, escolha **Deploy from a branch**, selecione a
branch principal e a pasta raiz, e salve. O endereço Pages aparecerá nessa
mesma página após a publicação. O app está em `index.html`; `app.js` contém a
lógica da biblioteca e ambos são servidos diretamente pelo Pages.

Abra `index.html` para usar localmente. Os registros ficam no `localStorage` do
navegador e dispositivo em uso; não são enviados ao GitHub nem sincronizados
entre dispositivos. Use a aba **Arquivo** para exportar ou importar uma cópia
JSON. O GitHub Pages publica conteúdo público e não oferece autenticação para
este app; não guarde informações sensíveis nele.
