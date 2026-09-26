# AI 4D V2 — Web App

Primeira interface utilizável do produto experimental AI 4D.

## Fluxo

1. Carregar um CSV.
2. Detectar a primeira coluna numérica.
3. Calcular tendência recente e uma previsão baseline.
4. Exibir métricas e gráfico temporal.

## Formato

`timestamp,signal_a,signal_b`

A V2 usa a primeira coluna numérica encontrada como sinal principal.

## Importante

Esta versão usa um método estatístico simples e determinístico. Ela não representa um modelo de machine learning treinado nem deve ser usada para decisões críticas.

## Próximas evoluções

- múltiplos sinais;
- backend e API;
- modelo de ML treinável;
- detecção de anomalias;
- autenticação e projetos;
- persistência em banco de dados;
- infraestrutura cloud.