# O Santuário do Eremita Literário

Tracker de leitura com estética de biblioteca clássica. A versão estática em
`index.html` funciona sem servidor e pode ser publicada diretamente no GitHub
Pages. Cadastre livros, registre o avanço diário e acompanhe médias e previsões.

## Publicar no GitHub Pages

1. Envie `index.html` para a raiz do repositório no GitHub.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**.
4. Escolha a branch principal e a pasta **/(root)**; salve.
5. Aguarde a publicação e abra o endereço indicado pelo GitHub Pages.

Não é necessário instalar Python, configurar um backend ou rodar uma etapa de
build. Também é possível testar localmente abrindo `index.html` no navegador.

## Dados e privacidade

A versão HTML salva o catálogo no `localStorage` do navegador. Os dados ficam
naquele navegador e dispositivo; não são sincronizados entre usuários ou
dispositivos. Use **Exportar meus registros** para baixar uma cópia JSON e
**Importar cópia** para restaurá-la ou transferi-la. Limpar os dados do
navegador pode apagar registros que não foram exportados.

## Versão Python opcional

`app.py` é a versão Streamlit para execução local:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

O SQLite local usado pelo Streamlit não é compartilhado com a versão HTML.
Fontes decorativas são carregadas do Google Fonts quando há conexão; o restante
da versão HTML funciona sem dependências externas.
