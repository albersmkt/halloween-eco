# Halloween ECOS

Experiência estática, sem dependências. Requer Python 3 para o servidor local.

```sh
cd /workspace/halloween-eco
python -m http.server 3000 --bind 0.0.0.0
```

“Entrar” reproduz o vídeo 01; somente ao terminar, a página avança para a seção 02. “Próximo” reproduz o vídeo 02. Como os demais vídeos ainda não foram enviados, ele termina nessa seção, com opção de rever. O som inicia desligado e pode ser ativado no cabeçalho. Os vídeos verticais são preservados integralmente no desktop e preenchem a tela no celular.

Para adicionar os próximos capítulos, siga a estrutura das seções em `index.html`, adicione os arquivos em `media/` e atualize os contadores. O controlador detecta as seções automaticamente.
