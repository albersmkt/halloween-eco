# Halloween ECOS

Experiência estática, sem dependências. Requer Python 3 para o servidor local.

```sh
cd /workspace/halloween-eco
python -m http.server 3000 --bind 0.0.0.0
```

“Entrar” reproduz o vídeo 01; somente ao terminar, a página avança para a seção 02. “Próximo” reproduz o vídeo 02. Como os demais vídeos ainda não foram enviados, ele termina nessa seção, com opção de rever. A interface exibe somente os vídeos e um botão com seta neon laranja, centralizado na lateral direita e com rótulo acessível. Os vídeos permanecem sem som. Os vídeos verticais são preservados integralmente no desktop e são exibidos sem cortes em qualquer tela; na TV vertical 9:16, preenchem toda a tela.

Para adicionar os próximos capítulos, siga a estrutura das seções em `index.html`, adicione os arquivos em `media/` e atualize os contadores. O controlador detecta as seções automaticamente.
