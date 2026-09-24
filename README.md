# Agenda da Quadra

PWA de agendamento para quadras esportivas (futsal, basquete, society…), **100% local**: sem backend, sem login, funciona offline depois do primeiro acesso. Os dados ficam no IndexedDB do aparelho, com backup em arquivo.

> Status: **marco 7 concluído (todos os marcos)**: agenda, reservas, pagamentos, clientes, mensalistas, Resumo, backup e restauração, Configurações e assistente inicial, mais os recursos da demonstração (faixa, tour, "Tenho interesse", restaurar exemplos), instalação do app e publicação automática no GitHub Pages.

## Requisitos

- Node.js 22 ou mais novo
- pnpm 11 (o projeto usa o `pnpm-workspace.yaml` para liberar o build do esbuild)

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
  domain/        regras de negócio puras + testes (datas, horários, preço, conflito, recorrência, pagamentos, métricas, telefone)
  db/            Dexie (IndexedDB), migrações, bootstrap, seed (dados de exemplo)
  features/      telas: agenda, mensalistas, clientes, resumo, mais, onboarding, demo
  components/    layout e componentes compartilhados
  license/       LicenseService (esboço: demonstração ou licenciado)
  pwa/           aviso de nova versão e "Instalar app"
  utils/         ids, roteador por hash, download, área de transferência
  test/          fixtures e setup dos testes
public/          favicon e ícones do PWA
.github/         workflow de publicação no GitHub Pages
```

## Personalizar para um cliente (tenant)

Edite somente `src/config/tenant.config.ts`:

- `tenantId`: identificador fixo do cliente. **Define o nome do banco no aparelho (`agenda-quadra-<tenantId>`). Nunca altere depois de publicar**, senão o app abre um banco vazio.
- nome, nome curto, logo, cores, quadras, horário de funcionamento, tabela de preços, telefone de contato do vendedor (`contactPhone`, exibido como texto na demonstração), telefone da quadra (opcional) e `demo: true/false`.
- O manifest do PWA (nome, cor, ícones) e o título da página são gerados a partir desse arquivo no `build`.
- Para trocar os ícones, substitua os PNGs em `public/icons/` (192, 512 e maskable 512) mantendo os nomes, ou aponte outros caminhos em `icons`.

Com `demo: true`, o primeiro acesso já vem com dados de exemplo gerados a partir da data atual. Com `demo: false`, o app grava só a configuração e as quadras/preços do tenant e abre o assistente de configuração inicial.

## Publicar no GitHub Pages

O repositório já traz o workflow `.github/workflows/deploy.yml`. A cada `git push` na branch `main`, o GitHub instala as dependências, roda os testes, gera o `dist/` e publica o site. Não há segredo nem chave: o workflow usa só o token temporário que o GitHub cria em cada execução.

**Configuração (uma vez só):**

1. No GitHub, abra o repositório › **Settings** › **Pages**.
2. Em **Build and deployment › Source**, escolha **GitHub Actions**.
3. Faça `git push`. Acompanhe na aba **Actions** (leva 1 a 2 minutos).
4. O endereço aparece em Settings › Pages, no formato `https://<usuario>.github.io/<repositorio>/` (aqui: `https://ricardorb06.github.io/SoccManager/`).

**Para mostrar no celular:** abra o endereço no navegador, confira a faixa "Versão de demonstração" e, se quiser, instale pelo item **Mais › Instalar app**. Depois do primeiro acesso o app funciona sem internet.

**Observações:**

- Se o repositório for privado, o GitHub Pages exige um plano pago; com o plano gratuito, o repositório precisa ser público. Nesse caso, lembre que o código (e o e-mail dos commits) fica visível.
- O caminho do site (`/SoccManager/`) é passado ao build pela variável `VITE_BASE` dentro do workflow; não é preciso editar nada.
- Nova versão publicada: quem já tem o app aberto vê o aviso "Nova versão disponível" e atualiza com um toque. Os dados continuam no aparelho.
- Para testar a versão de produção no seu computador antes de publicar: `pnpm build` e depois `pnpm preview`.
- Para gerar a versão de um cliente real, crie uma cópia do repositório, edite o `tenant.config.ts` (com `demo: false` e um `tenantId` próprio) e publique do mesmo jeito.

## Demonstração (`demo: true`)

- **Faixa "Versão de demonstração"** no topo de todas as telas, com o botão **Como funciona?**.
- **Tour guiado**: 4 balões apontando para Agenda, Mensalistas, Resumo e Mais. Só abre pelo botão "Como funciona?"; dá para pular (botão, Esc ou toque fora) e rever quando quiser.
- **Tenho interesse**: cartão no fim do Resumo. Mostra o telefone do vendedor (`contactPhone`) como texto e um botão que só **copia** o número. Nada é enviado e nenhum app externo é aberto. **Troque o número fictício pelo seu antes de publicar.**
- **Restaurar dados de exemplo** (Mais): volta a demonstração ao estado inicial, com datas a partir de hoje. Pede confirmação, guarda uma cópia interna antes e oferece "Desfazer".
- **Licença**: `src/license/LicenseService.ts` é um esboço. Hoje devolve "demonstração" ou "licenciado para <quadra>" conforme o `demo` do tenant; o nome licenciado aparece na barra lateral do desktop e no rodapé de Mais. Não há verificação online nem chave.

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
6. ~~WhatsApp~~: removido depois do marco 6 (ver "Sem integrações externas").
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
10. ~~Mensagem "Cobrar mensalidade"~~: removida junto com o WhatsApp.

## Decisões técnicas (marco 5)

1. **Períodos**: mês atual (do dia 1 ao último dia), últimos 30 dias (hoje incluso) e mês anterior.
2. **Recebido** conta pagamentos pela data em que foram lançados; **a receber** = jogos já realizados com saldo + mensalidades vencidas do período.
3. **Ocupação, mapa de calor e horas vazias** usam só horários que já passaram; bloqueios não contam como vazio. Horas vazias são valoradas pela tabela de preços, então batem com o "Livre · R$ X" da agenda.
4. **Sugestão de promoção**: os 3 horários com menor ocupação (mínimo de 2 amostras) e um preço 25% menor que a média das quadras, arredondado para R$ 5.
5. **Mapa de calor** em CSS grid (sem biblioteca de gráficos), escala de uma só cor (a da quadra), valor exato ao tocar ou passar o mouse.
6. **CSV**: separador `;`, UTF-8 com BOM, vírgula decimal e datas dd/MM/aaaa (abre certo no Excel brasileiro). Dois arquivos: reservas (inclui jogos de mensalistas) e pagamentos.
7. **Impressão**: versão própria para papel (A4, uma página, tabela por quadra), acionada pelo botão "Imprimir agenda do dia".

## Backup e restauração (como usar)

- **Fazer backup:** Mais › Backup e segurança › "Salvar arquivo" (ou "Compartilhar", que abre o menu de compartilhamento do próprio aparelho). O arquivo se chama `backup-<quadra>-AAAA-MM-DD-HHmm.json` e contém tudo. O botão também aparece em "Encerrar o dia" e num aviso no topo quando o último backup está velho.
- **Restaurar / trocar de aparelho:** Mais › Backup e segurança › "Escolher arquivo de backup". O app valida o arquivo, mostra o que tem nele (reservas, clientes, data), pede confirmação, guarda uma cópia do estado atual e só então substitui. Logo depois aparece "Desfazer".
- **Cópias internas:** uma por dia, automática, as 5 mais recentes, para desfazer erros. Ficam no próprio aparelho: não substituem o backup em arquivo.
- **Arquivo inválido** (ou de uma versão mais nova do app) é recusado sem alterar nada. Backups de versões anteriores são convertidos automaticamente.

## Decisões técnicas (marco 6)

1. **Formato do backup**: `{ format, schemaVersion, appVersion, tenantId, exportedAt, data }`, validado com Zod antes de qualquer gravação; a substituição acontece numa única transação.
2. **Cópias internas** guardadas numa tabela própria (`snapshots`), fora do backup; no máximo 5. Também são criadas antes de importar e antes de restaurar uma cópia, então toda troca de dados pode ser desfeita.
3. **Armazenamento persistente** é pedido na primeira abertura (`navigator.storage.persist()`); a tela mostra se foi concedido e o espaço usado.
4. **Lembrete de backup**: aparece quando o último backup tem mais dias que o configurado (padrão 7) ou, se nunca foi feito, depois de 10 reservas criadas pelo usuário (os dados de exemplo não contam).
5. **Quadras com histórico não podem ser excluídas**, só desativadas; a regra de preço de uma quadra excluída sai junto.
6. **Logo** é reduzida para no máximo 256 px e guardada no banco (vai junto no backup).
7. **Assistente inicial** só aparece com `demo: false` e reaproveita as telas de Configurações (estabelecimento → quadras → horários → preços), partindo dos valores do `tenant.config.ts`.

## Decisões técnicas (marco 7)

1. **Tour sem biblioteca**: os balões procuram o alvo por `data-tour` e escolhem sozinhos a posição (acima da barra inferior no celular, à direita da barra lateral no desktop). O tour navega para cada aba enquanto explica.
2. **"Instalar app" só em Mais**: o aviso `beforeinstallprompt` do navegador é guardado ao abrir o app e usado quando a pessoa toca no item. No iPhone (que não tem esse aviso) aparece o passo a passo do Safari; com o app já instalado, o item mostra "App instalado".
3. **Restaurar exemplos** reaproveita as cópias internas do marco 6 (motivo "antes de restaurar exemplo") e preserva só as chaves do aparelho (`persistRequested`, `lastSnapshotDate`).
4. **Publicação por GitHub Actions** com `pnpm install --frozen-lockfile`, testes antes do build e `VITE_BASE=/<repositorio>/`.

## Sem integrações externas

O app não envia nem recebe dados de nenhum serviço. As integrações de WhatsApp (mensagens prontas, cobrança e modelos editáveis) e a chave Pix foram removidas; os telefones continuam guardados e exibidos, e o link `tel:` só abre o discador do próprio aparelho quando alguém toca no número. O que sai do aparelho só sai por ação da pessoa: baixar/compartilhar o backup, exportar CSV, imprimir e copiar o telefone do vendedor para a área de transferência (demonstração).

## Limitações conhecidas

- Os dados ficam no aparelho: limpar os dados do navegador apaga tudo. Por isso o app tem backup em arquivo, lembretes e cópias internas.
- Não há sincronização entre aparelhos nem agendamento feito pelo cliente final.
