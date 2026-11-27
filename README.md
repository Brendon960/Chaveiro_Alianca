# Chaveiro Aliança BH — Site, Painel Administrativo e Painel do Desenvolvedor

Site institucional focado em **serviços de chaveiro automotivo** (prioridade: cópia de chave automotiva),
com conversão via WhatsApp. Não é loja virtual: não há carrinho nem checkout.

| Área | Endereço | Perfil |
|---|---|---|
| Landing page | `/` | público |
| Painel administrativo | `/admin` | Administrador (dono da loja) — o Desenvolvedor também acessa |
| Painel do desenvolvedor | `/dev` | **somente** Desenvolvedor |

## Como rodar

Requisito: Node.js 18 ou superior.

```bash
npm install
npm start
```

`npm start` sobe o servidor por meio de um supervisor (`launcher.js`), que permite o botão
"Reiniciar aplicação" do painel do desenvolvedor e reinicia o servidor se ele cair.

### Acessos iniciais (troca de senha obrigatória no primeiro login)

| Painel | Usuário | Senha inicial |
|---|---|---|
| Administrativo | `admin` | `alianca2026` |
| Desenvolvedor | `dev` | `devalianca2026` |

Para outras senhas iniciais, defina `ADMIN_PASSWORD` / `DEV_PASSWORD` antes do primeiro start.

## Painel administrativo

- **Serviços** — ordem, imagem, título, descrição, texto do "Serviço desejado" na mensagem do WhatsApp, visível/oculto, destaque.
- **Produtos** — cards com busca e filtro por categoria; formulário lateral com prévia ao vivo; foto (JPG/PNG), preço opcional,
  "mostrar preço no site", visível/oculto; gerenciamento de categorias.
- **Textos do site** — hero (título, subtítulo, botões, imagem) e todas as seções.
- **Contato e WhatsApp** — número (DDI + DDD), mensagem padrão do orçamento, endereço, horário e redes sociais.

## Painel do desenvolvedor

- **Visão geral** — status (Online / Em manutenção), erros e avisos em 24 h, último backup, checagem de saúde
  (banco, imagens, SSL, WhatsApp, backup automático) e erros recentes.
- **Logs** — filtros por nível e origem, busca, detalhe técnico e exportação CSV. São registrados logins e tentativas
  inválidas, alterações no painel, cliques no WhatsApp, erros de carregamento, imagens não encontradas, falhas de upload,
  backups e ações de manutenção (arquivo `data/logs.jsonl`, últimos 5.000 registros).
- **Manutenção** — modo manutenção com mensagem editável e prévia; limpar cache; gerar backup; restaurar último backup;
  reiniciar aplicação. Toda ação pede confirmação e é registrada.

## Antes de publicar — pendências com a empresa

O site não inventa serviços, marcas, preços ou garantias. Enquanto não houver confirmação, aparecem espaços reservados:
`[PREÇO]`, `[ENDEREÇO]`, `[HORÁRIO]`, `[NÚMERO DO WHATSAPP]`.

1. Cadastrar o **número do WhatsApp** (sem ele os orçamentos não chegam à empresa).
2. Preencher **endereço** e **horário**.
3. Ativar **Recuperação de chaves** e **Abertura automotiva** somente se a empresa oferecer (estão ocultos).
4. Trocar as ilustrações provisórias por **fotos reais** de chaves, controles e equipamentos.

## Estrutura

```
launcher.js          Supervisor (reinício pelo painel / em caso de queda)
server.js            Servidor Express: site, APIs, perfis, logs, manutenção
lib/defaults.js      Conteúdo inicial e espaços reservados
lib/db.js            Banco em data/db.json (com migração de versões)
lib/auth.js          Senhas (scrypt), sessões e bloqueio após 5 tentativas
lib/logger.js        Logs em data/logs.jsonl
lib/backup.js        Backups em backups/ (banco + imagens, mantém 14)
public/              Landing page, página de manutenção, /admin e /dev
uploads/             Imagens enviadas pelo painel
```

## Hospedagem

Precisa de um serviço que rode Node.js (VPS, hospedagem com Node.js, Render, Railway etc.). Com PM2, use
`pm2 start server.js` (o reinício pelo painel funciona com PM2 também).
Variáveis opcionais: `PORT`, `ADMIN_USER`, `ADMIN_PASSWORD`, `DEV_PASSWORD`, `DATA_DIR`, `UPLOAD_DIR`, `BACKUP_DIR`.

Use HTTPS em produção. O backup automático diário fica em `backups/` no mesmo servidor — copie essa pasta
periodicamente para outro local.
