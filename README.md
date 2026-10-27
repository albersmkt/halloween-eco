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

O PNG original está incluído em `media/selfie-frame.png` (941 × 1672, RGBA, centro transparente), extraído do ZIP fornecido pelo usuário. O build copia esse arquivo para `dist/media/selfie-frame.png`, disponibilizando a mesma moldura a todos os dispositivos sem configuração local.

## Vercel

`vercel.json` define o build `npm run build`, a saída `dist` e as funções Node. Se houver overrides manuais no painel, alinhe-os a esses valores. Os vídeos originais ficam em `media/`.

1. Em Storage, criar um **Vercel Blob privado** e conectá-lo ao projeto, incluindo Production.
2. A conexão atual usa **OIDC**, com `BLOB_STORE_ID` disponibilizado pela integração e identidade fornecida pelo runtime Vercel. Não é necessário criar `BLOB_READ_WRITE_TOKEN`. O SDK também aceita o token legado para conexões antigas. Nunca colocar credenciais no frontend ou Git.
3. Fazer novo deploy após conectar o armazenamento.
4. No totem, abrir o domínio HTTPS e autorizar a webcam.
5. Percorrer os seis vídeos, permitir a câmera quando solicitada ao entrar na tela final, conferir a moldura e tocar em Tirar selfie e verificar a contagem de 5 a 1. Escanear o QR com outro aparelho e confirmar o download JPEG com a moldura.

A foto é composta localmente em 1080 × 1920, espelhada como a prévia e com a moldura por cima. Depois da captura, a câmera é desligada. A imagem só é enviada ao servidor depois do clique e da contagem. O QR contém um link HTTPS de download com identificador aleatório não enumerável, válido por 24 horas, sem expor credenciais. A expiração faz parte do caminho privado imutável do objeto; alterá-la aponta para um arquivo inexistente. Links antigos assinados com token continuam compatíveis enquanto houver o token original. Uploads aceitam JPEG de até 3 MiB, da mesma origem. Configure limites de requisições no Vercel Firewall para o endpoint público de upload conforme o uso do evento.

**Validade do link não significa exclusão:** os objetos privados permanecem no Blob até a equipe apagá-los. Defina a rotina de exclusão das fotos do evento no armazenamento. Quem tiver o QR pode baixar a foto durante a validade.

## Validação

`npm test` cobre a ordem das seis transições, avanço instantâneo para a selfie, contagem de cinco segundos, composição de câmera e moldura, interrupção da webcam, rejeição de upload inválido e validação de links assinados/expirados. Esses testes usam câmera e armazenamento simulados. Não substituem o teste da webcam física, do Blob real e do download pelo smartphone.

## Se o QR code não aparecer

A tela distingue armazenamento ausente (HTTP 503), falha de autenticação OIDC ou loja incompatível (502), publicação sem API (404), envio bloqueado (403), imagem grande demais (413) e falha de conexão. A selfie permanece no canvas e pode ser reenviada sem nova captura. Conectar o Blob exige um novo deploy para disponibilizar BLOB_STORE_ID e a identidade OIDC no servidor. O código não produz um QR local que só funcionaria no totem: o upload precisa ser confirmado antes da geração do link.

A webcam inicia ao entrar na última tela, sem botão Ativar câmera. O único botão de captura é Tirar selfie; se for necessário repetir a permissão, esse mesmo botão tenta abrir a webcam antes da contagem. A permissão nativa do navegador continua obrigatória.

O totem não oferece download local da selfie: o acesso à foto é apenas pelo QR code no smartphone. Após avançar da primeira página, 40 segundos sem toque, clique ou tecla fazem o totem desligar a câmera e recarregar a tela inicial. Cada nova interação reinicia o prazo; a apresentação do QR code também inicia um prazo completo de 40 segundos para escaneá-lo. A tela inicial pode permanecer parada sem recargas contínuas. O retorno ao início não invalida o link de 24 horas já emitido.
