# Halloween ECOS

Totem vertical 9:16: seis vídeos em sequência, com avanço instantâneo após cada reprodução e uma tela final de selfie. O primeiro botão mostra “Entrar no museu”; os outros mostram setas. Todos têm neon laranja pulsante (respeitando a preferência de movimento reduzido).

## Desenvolvimento

Requer Node 20+ e npm. Use o checkout existente; não é necessário criar worktrees.

```sh
npm ci
npm test
npm run build
npm start
```

O servidor Python serve `dist` na porta 3000 para verificar os arquivos estáticos. As rotas de armazenamento em `api/` precisam do runtime Vercel (`vercel dev` ou implantação), não são executadas por Python. A câmera exige HTTPS ou localhost e permissão do navegador. Webcam física e QR code em smartphone devem ser testados no totem implantado.

## Moldura necessária

A moldura é aplicada automaticamente à prévia e incorporada ao JPEG. Não há seletor de arquivo para visitantes. O arquivo fixo esperado é `media/selfie-frame.png`, com centro transparente. Como compatibilidade, o totem também restaura automaticamente a arte já instalada em IndexedDB nesse navegador nas versões anteriores.

O PNG original ainda não está disponível no checkout: o caminho `/Users/...` pertence ao computador do usuário. Até o arquivo ser incluído no projeto, a arte já instalada só é restaurada no mesmo navegador e domínio. Outros dispositivos e navegadores sem essa configuração continuam sem moldura; não foi criada uma arte substituta.

## Vercel

`vercel.json` define o build `npm run build`, a saída `dist` e as funções Node. Se houver overrides manuais no painel, alinhe-os a esses valores. Os vídeos originais ficam em `media/`.

1. Em Storage, criar um **Vercel Blob privado** e conectá-lo ao projeto, incluindo Production.
2. Confirmar a variável **`BLOB_READ_WRITE_TOKEN`**, criada pela integração. Nunca colocar o token no frontend ou Git.
3. Fazer novo deploy após conectar o armazenamento.
4. No totem, abrir o domínio HTTPS e autorizar a webcam.
5. Percorrer os seis vídeos, ativar câmera, conferir a moldura, tirar selfie e verificar a contagem de 5 a 1. Escanear o QR com outro aparelho e confirmar o download JPEG com a moldura.

A foto é composta localmente em 1080 × 1920, espelhada como a prévia e com a moldura por cima. Depois da captura, a câmera é desligada. A imagem só é enviada ao servidor depois do clique e da contagem. O QR contém um link HTTPS assinado de download, válido por 24 horas, sem expor credenciais. Uploads aceitam JPEG de até 3 MiB, da mesma origem. Configure limites de requisições no Vercel Firewall para o endpoint público de upload conforme o uso do evento.

**Validade do link não significa exclusão:** os objetos privados permanecem no Blob até a equipe apagá-los. Defina a rotina de exclusão das fotos do evento no armazenamento. Quem tiver o QR pode baixar a foto durante a validade.

## Validação

`npm test` cobre a ordem das seis transições, avanço instantâneo para a selfie, contagem de cinco segundos, composição de câmera e moldura, interrupção da webcam, rejeição de upload inválido e validação de links assinados/expirados. Esses testes usam câmera e armazenamento simulados. Não substituem o teste da webcam física, do Blob real e do download pelo smartphone.

## Se o QR code não aparecer

A tela distingue armazenamento ausente (HTTP 503), falha do Blob/token ou loja incompatível (502), publicação sem API (404), envio bloqueado (403), imagem grande demais (413) e falha de conexão. A selfie permanece no canvas e pode ser reenviada sem nova captura. Conectar o Blob exige um novo deploy para injetar a variável no servidor. O código não produz um QR local que só funcionaria no totem: o upload precisa ser confirmado antes da geração do link.
