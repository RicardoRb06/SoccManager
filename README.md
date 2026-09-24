# Agenda da Quadra

PWA de agendamento para quadras esportivas (futsal, basquete, society…), **100% local**: sem backend, sem login, funciona offline depois do primeiro acesso. Os dados ficam no IndexedDB do aparelho, com backup em arquivo.

> Status: **marco 4 concluído**: Agenda, reservas, pagamentos, clientes, WhatsApp e mensalistas completos (criar pela agenda ou pela tela Mensalistas, conflitos nas próximas 12 semanas, pular/desfazer data, remarcar, pausar/retomar/encerrar, mensalidade e receita fixa prevista). Próximo: Resumo, CSV e impressão (marco 5).

## Requisitos

- Node.js 20 ou mais novo
- pnpm 9 ou 10 (`corepack enable` já disponibiliza o pnpm)

## Comandos

```bash
pnpm install        # instala as dependências
pnpm test           # testes de domínio, seed e banco (Vitest)
pnpm typecheck      # TypeScript strict
pnpm dev            # servidor de desenvolvimento (http://localhost:5173)
pnpm build          # gera a versão de produção em dist/
pnpm preview        # serve o dist/ localmente (teste do PWA/offline)
```

O service worker só é ativado no `build` + `preview` (ou publicado). No `dev` o app roda sem cache offline.

## Estrutura

```
src/
  config/        tenant.config.ts (o ÚNICO arquivo a editar por cliente) e tipos
  domain/        regras de negócio puras + testes (datas, horários, preço, conflito, recorrência, pagamentos, métricas, WhatsApp)
  db/            Dexie (IndexedDB), migrações, bootstrap, seed (dados de exemplo)
  features/      telas: agenda, mensalistas, clientes, resumo, mais
  components/    layout e componentes compartilhados
  pwa/           aviso de nova versão
  utils/         ids, roteador por hash
  test/          fixtures e setup dos testes
public/          favicon e ícones do PWA
```

## Personalizar para um cliente (tenant)

Edite somente `src/config/tenant.config.ts`:

- `tenantId`: identificador fixo do cliente. **Define o nome do banco no aparelho (`agenda-quadra-<tenantId>`). Nunca altere depois de publicar**, senão o app abre um banco vazio.
- nome, nome curto, logo, cores, quadras, horário de funcionamento, tabela de preços, WhatsApp de contato (vendedor), chave Pix, textos das Condições e `demo: true/false`.
- O manifest do PWA (nome, cor, ícones) e o título da página são gerados a partir desse arquivo no `build`.
- Para trocar os ícones, substitua os PNGs em `public/icons/` (192, 512 e maskable 512) mantendo os nomes, ou aponte outros caminhos em `icons`.

Com `demo: true`, o primeiro acesso já vem com dados de exemplo gerados a partir da data atual. Com `demo: false`, o app grava só a configuração e as quadras/preços do tenant (o assistente de configuração inicial chega no marco 6).

## Publicar (resumo; o passo a passo completo vem no marco 7)

O `base` padrão é relativo (`./`), então o mesmo `dist/` funciona em domínio próprio, subdomínio ou subcaminho (ex.: GitHub Pages em `/nome-do-repo/`). Se preferir um caminho absoluto: `VITE_BASE=/nome-do-repo/ pnpm build`.

## Decisões técnicas (marco 1)

1. **pnpm** como gerenciador (pedido do projeto). A liberação do script de instalação do esbuild fica em `pnpm-workspace.yaml` (`allowBuilds`).
2. **Datas como `YYYY-MM-DD` e horários em minutos** (`20:00` = 1200, `24:00` = 1440). As funções de data em `domain/dates.ts` são próprias e usam `Date.UTC` internamente, então fuso e horário de verão nunca deslocam um dia. O `date-fns` continua disponível para a interface, mas o domínio não depende dele.
3. **Dinheiro em centavos** (inteiros), formatado com `Intl.NumberFormat('pt-BR', BRL)`.
4. **Roteador por hash próprio** (`utils/router.ts`, ~40 linhas) em vez de react-router: mesmo efeito do HashRouter, sem dependência extra.
5. **Preço proporcional por faixa**, arredondado só no total (sem erro acumulado). Regra da quadra vence a regra `*`; entre regras do mesmo nível, vale a primeira da lista. Trechos sem regra ficam com R$ 0 e são sinalizados.
6. **Mensalistas**: ocorrências virtuais calculadas pela regra. Qualquer reserva com o mesmo `recurrenceId` + data suprime a virtual (inclusive cancelada ou na lixeira), para uma ocorrência nunca "ressuscitar". Foi adicionado o campo `pausedAt` à regra: pausar mantém o histórico e só para de gerar a partir dessa data.
7. **Mensalidade**: devida em cada mês com ao menos uma data da regra (pular uma data não abate a mensalidade). "Em dia" quando a soma dos pagamentos do mês ≥ valor mensal.
8. **Métricas por slot**: ocupação, mapa de calor e horas vazias usam só horários **já passados** do período; bloqueios e horário tomado por quadra do mesmo espaço físico não contam como "vazio".
9. **"A receber"** considera apenas jogos já realizados (até o momento atual) e mensalidades em aberto até o mês atual.
10. **Seed determinístico** (PRNG com semente fixa) relativo à data atual, validado por teste: nenhum conflito, tudo dentro do expediente, terças e quartas à tarde vazias, noites cheias.
11. **Migrações**: esquema físico pelo Dexie (`db.version(n)`, nunca editar versão publicada); formato lógico do backup por `db/migrations.ts` (`SCHEMA_VERSION`), para importar backups antigos.
12. **Fontes do sistema** (sem fontes remotas), Tailwind v4 com cores da quadra em variáveis CSS aplicadas em runtime.

## Decisões técnicas (marco 2)

1. **Conflito checado duas vezes**: ao vivo no formulário (mostra quem ocupa e sugere 3 horários) e de novo **dentro da transação** do banco (`db/repo.ts`). Mesmo com a tela desatualizada, não há como gravar uma reserva sobreposta.
2. **Data na URL** (`#/agenda/2026-09-24`): recarregar ou voltar mantém o dia aberto.
3. **Cliente novo criado junto com a reserva**, na mesma transação: se o horário estiver ocupado, nem a reserva nem o cliente são gravados.
4. **Bloqueio sobre reservas existentes**: o app avisa quais reservas caem no período, mas não cancela nenhuma sozinho (o dono decide e remarca).
5. **Durações**: chips de 1h, 1h30 e 2h (só os múltiplos do slot configurado) e ajuste fino com − / + no tamanho do slot.
6. **Ocorrências de mensalista**: nesta etapa só abrem para consulta. Pagamento, falta e "pular data" entram no marco 4.

## Decisões técnicas (marco 3)

1. **Pagamento é sempre um lançamento** (tabela `payments`); pago, sinal e saldo são calculados, nunca gravados. "Quitar" cria um lançamento com o saldo exato, dentro de uma transação.
2. **Remover pagamento** existe só para corrigir lançamento errado, com confirmação.
3. **Falta** mantém o horário ocupado e o saldo em aberto (o dono decide se cobra).
4. **Débito do cliente** = jogos já realizados com saldo + jogos de mensalista por jogo não pagos + mensalidades em aberto até o mês atual.
5. **Jogos do cliente** incluem as datas já passadas dos mensalistas (ocorrências que não precisaram ser registradas).
6. **WhatsApp**: a mensagem usa o primeiro nome do cliente; sem telefone válido, o link abre o WhatsApp para escolher o contato. A edição dos textos entra em Configurações (marco 6).
7. **Encerrar o dia**: recebido = pagamentos lançados na data (por forma de pagamento); pendências = saldos dos jogos daquele dia. O botão "Salvar backup agora" entra no marco 6.

## Decisões técnicas (marco 4)

1. **Criar mensalista** é o mesmo formulário da reserva com "Repetir toda semana". As próximas 12 semanas (ou até a data final) são checadas; havendo conflitos, o app lista as datas e oferece "Pular essas datas e criar". A checagem é repetida dentro da transação.
2. **Pausar** para de gerar jogos a partir de hoje e mantém o histórico. **Retomar** transforma as semanas pausadas em exceções (para não "reaparecerem") e checa conflitos antes de voltar.
3. **Encerrar** define a data do último jogo; o histórico e os pagamentos continuam.
4. **Pular data** libera o horário (se o jogo já tinha sido registrado, a reserva dele é cancelada). "Desfazer" só funciona se o horário ainda estiver livre.
5. **Remarcar** pula a data original e cria a reserva avulsa no novo horário na mesma transação: se o novo horário estiver ocupado, nada muda.
6. **Pagamento e falta** de um jogo de mensalista "materializam" a ocorrência (vira reserva com `recurrenceId`), sem duplicar na agenda.
7. **Editar mensalista** muda nome do time, forma de cobrança, valores e data final. Para mudar dia, horário ou quadra, encerra-se e cria-se outro, para não reescrever o histórico.
8. **Mensalidade vence** quando o primeiro jogo do mês chega (um mensalista criado hoje para a semana que vem não aparece devendo).
9. **Receita fixa prevista** = mensalidades dos ativos + (preço × jogos do mês) dos ativos por jogo.
10. Novo modelo de mensagem **"Cobrar mensalidade"** (variável `{mes}`), que entra automaticamente também em bancos criados antes.

## Limitações conhecidas

- Os dados ficam no aparelho: limpar os dados do navegador apaga tudo. Por isso o app terá backup em arquivo, lembretes e cópias internas (marco 6).
- Não há sincronização entre aparelhos nem agendamento feito pelo cliente final.
