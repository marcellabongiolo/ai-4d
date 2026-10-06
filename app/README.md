# AI 4D V2 — Web App

Interface do produto experimental AI 4D para análise temporal de dados.

## Fluxo

1. Criar uma conta ou entrar.
2. Carregar um CSV.
3. Detectar sinais e calcular métricas temporais.
4. Executar o baseline local ou usar a API para previsão ML.
5. Sincronizar análises autenticadas com o histórico privado da conta.

## Formato

`timestamp,signal_a,signal_b`

A V2 usa a primeira coluna numérica encontrada como sinal principal.

## Autenticação

O frontend usa o token Bearer retornado por `/auth/register` ou `/auth/login`. O token é mantido no armazenamento local do navegador para manter a sessão entre recarregamentos.

A URL da API é configurável na interface e é salva localmente no navegador.

## Importante

Esta versão continua experimental. Os resultados não devem ser usados como decisões críticas. A API deve usar HTTPS e uma chave `AI4D_SECRET_KEY` forte em produção.

## Próximas evoluções

- experiência de conta mais completa;
- projetos por usuário;
- recuperação e reabertura de análises;
- PostgreSQL e migrações de banco;
- infraestrutura cloud;
- modelo ML mais robusto e avaliação contínua.
