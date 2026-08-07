# 📁 Folderlan · [![NodeJS CI](https://github.com/ImMau14/Folderlan/actions/workflows/node-ci.yaml/badge.svg)](https://github.com/ImMau14/Folderlan/actions/workflows/node-ci.yaml) [![Rust CI](https://github.com/ImMau14/Folderlan/actions/workflows/rust-ci.yaml/badge.svg)](https://github.com/ImMau14/Folderlan/actions/workflows/rust-ci.yaml)

**Esqueça as limitações. Compartilhe arquivos instantaneamente, diretamente entre dispositivos.**

[English](README.MD) · [Español](README.es.md) · [Italiano](README.it.md) · **Português**

Folderlan é uma plataforma de compartilhamento de arquivos self‑hosted. Um servidor, qualquer dispositivo com um navegador. Sem internet necessária na sua LAN, sem nuvem de terceiros, sem assinatura — seus arquivos ficam no seu próprio hardware.

---

<img width="1024" height="600" alt="Painel do Folderlan" src="https://pbdecn9fvkmyynkh.public.blob.vercel-storage.com/285shots_so.webp" />

---

## Índice

- [O que é o Folderlan?](#o-que-é-o-folderlan)
- [Casos de uso](#casos-de-uso)
- [Principais recursos](#principais-recursos)
- [Início rápido](#início-rápido)
- [Acesso de outros dispositivos (LAN)](#acesso-de-outros-dispositivos-lan)
- [Implantação como nuvem privada (VPS)](#implantação-como-nuvem-privada-vps)
- [Configuração](#configuração)
- [Como funciona](#como-funciona)
- [Segurança e privacidade](#segurança-e-privacidade)
- [Compilar a partir do código-fonte](#compilar-a-partir-do-código-fonte)
- [Manutenção](#manutenção)
- [Licença](#licença)

---

## O que é o Folderlan?

O Folderlan é um **aplicativo cliente‑servidor empacotado em um único binário**. O backend (Rust + Actix‑web) é uma API REST que armazena arquivos em disco, mantém os metadados em um banco de dados SQLite embutido, lida com a autenticação e monitora sua própria pasta `uploads/` para registrar arquivos que aparecem sem passar pela interface web. O frontend (React) é compilado e **embutido no binário**, então um único executável *é* o aplicativo inteiro: servidor, API e interface web.

Você executa um programa, abre `http://<host>:8080` em qualquer navegador e tem um servidor de compartilhamento de arquivos totalmente funcional, com usuários, permissões, cotas e um registro de auditoria.

---

## Casos de uso

### 🏠 Transferência de arquivos na LAN — sem internet, sem cabos

O caso de uso original: dois dispositivos no mesmo Wi‑Fi, zero internet.

- Envie documentos, fotos, vídeos e arquivos grandes entre seu laptop, celular e desktop.
- Funciona totalmente offline — os dados nunca saem da sua rede.
- Ideal para aeroportos, escritórios, dormitórios ou lugares com internet instável.

### ☁️ Nuvem privada em um VPS — seu próprio "Google Drive" minimalista

Por causa da arquitetura cliente‑servidor, o mesmo binário se torna uma **nuvem self‑hosted minimalista** quando implantado em um VPS alugado.

- Acesse seus arquivos de qualquer lugar do mundo, em qualquer dispositivo.
- Dê a familiares, amigos ou colegas suas próprias contas com permissões granulares.
- Imponha cotas de armazenamento por usuário para ninguém encher o disco.
- Registro de auditoria completo de quem fez o quê, quando e de qual IP.
- Nenhuma conta de terceiros necessária — os dados são seus, no seu servidor.

### 👥 Compartilhamento de arquivos em equipes e escritórios

Pequenas equipes que só precisam de um espaço compartilhado sem adotar um SaaS completo.

- **Proprietário** (um) tem controle total; os **visitantes** recebem exatamente as permissões que você conceder.
- Papéis e acesso por arquivo: `viewer` (ver/baixar) vs `collaborator` (também excluir, compartilhar, tornar público).
- Visibilidade pública/privada por arquivo.
- Redefina senhas, suspenda contas, exclua usuários a qualquer momento.

### 📥 Automação com pasta de destino

O Folderlan monitora sua pasta `uploads/` em tempo real.

- Copie ou envie arquivos diretamente para a pasta (ou faça outro programa escrever nela) e eles aparecem na interface web automaticamente — registrados, pesquisáveis e compartilháveis, sem etapas manuais.
- Funciona ao contrário também: excluir o arquivo do disco o marca como excluído na interface.
- Útil para buckets de upload, depósitos de backup ou para alimentar uma biblioteca compartilhada a partir de um script de automação.

### 🔒 Biblioteca de mídia privada e hub de backups

- Mantenha fotos de família, backups de projetos e documentos em uma máquina que você controla.
- Autenticação JWT + hash de senhas com Argon2 mantêm visitantes indesejados fora.
- O registro de auditoria dá a você visibilidade total sobre quem acessou o quê.

---

## Principais recursos

### Gerenciamento de arquivos

- **Uploads em streaming** — arquivos grandes são transmitidos diretamente para o disco com progresso ao vivo na interface; pausar, retomar e cancelar por arquivo.
- **Armazenamento inteligente** — nomes de arquivo higienizados, deduplicação automática `name (1).ext`, detecção MIME.
- **Busca e filtros** — por nome, faixa de tamanho, data de upload, visibilidade e autor.
- **Downloads seguros** — em streaming com verificação de permissões em tempo real a cada requisição.
- **Visibilidade pública/privada** — por arquivo, alternável com um clique.
- **Compartilhamento granular** — conceda acesso `viewer` ou `collaborator` a um arquivo para usuários específicos.
- **Ações em massa** — selecione vários arquivos para baixar, excluir ou alterar a visibilidade de uma vez.

### Usuários, papéis e cotas

- **Um proprietário** — acesso total de administrador, criado durante a configuração inicial.
- **Visitantes ilimitados** — contas criadas pelo proprietário com permissões configuráveis:
  - `can_upload` — permitir/negar uploads.
  - `can_delete_own_files` — permitir excluir os próprios uploads.
  - `has_upload_limits` + `upload_limit` — cota de armazenamento por usuário em bytes.
- **Níveis de acesso por arquivo:** `viewer` (baixar) ou `collaborator` (excluir, compartilhar, tornar público).
- **Gerenciamento de contas** — ativar/suspender usuários, redefinir senhas, contas com exclusão suave (revogável).

### Monitoramento, auditoria e segurança

- **File System Watcher** — detecta instantaneamente arquivos adicionados ou removidos em `uploads/`, com verificações de estabilidade (aguarda o arquivo parar de crescer), deduplicação e proteção de concorrência baseada em locks.
- **Registro de auditoria completo** — toda ação relevante para a segurança é registrada com data/hora, usuário, endereço IP, tipo de evento e sucesso/falha; explorável na interface com filtros.
- **Autenticação JWT** — tokens de 1 hora, assinatura HS256, hash de senhas com Argon2.
- **Inicialização somente local** — configuração, registro do proprietário e redefinição de senha do proprietário aceitam requisições apenas da máquina host.
- **CORS configurável** — restrito ao seu origin por padrão; modo permissivo disponível.

### Interface e experiência

- **Binário único** — servidor + API + interface web embutida; nada mais para instalar.
- **Início sem configuração** — o banco de dados SQLite se inicializa sozinho no primeiro uso.
- **4 idiomas** — inglês, espanhol, italiano, português.
- **Temas claro e escuro** com detecção de preferência do sistema.
- **Responsivo** — layout completo para desktop, navegação inferior para mobile.
- **Modo de baixo detalhe** — desativa efeitos pesados em dispositivos com pouca capacidade.

---

## Início rápido

1. **Baixe a última release** para sua plataforma na [página de releases](https://github.com/ImMau14/Folderlan/releases). Binários pré‑compilados estão disponíveis para **Windows (32 e 64 bits)** e **Linux (64 bits)**, compilados automaticamente pelo GitHub Actions.
2. **Execute o binário** na máquina que hospedará seus arquivos.
3. **Abra um navegador** nessa máquina e acesse `http://localhost:8080` (a porta padrão).
4. **Conclua a configuração inicial:** a interface web abre na tela de configuração — clique em *Start*, escolha um **nome de usuário e senha de proprietário** (o proprietário é o administrador da sua instância do Folderlan) e você será conectado automaticamente, pronto para enviar arquivos.
5. **Comece a compartilhar.**

> [!WARNING]
> A configuração inicial (criação do banco de dados, registro do proprietário) deve ser feita **na própria máquina host** (`localhost`). Essas etapas são recusadas propositalmente em outros dispositivos.

O servidor cria um banco de dados SQLite (`db/app.db` por padrão) e uma pasta `uploads/` ao lado do binário. Todos os arquivos que você enviar ficam em `uploads/`.

> [!TIP]
> Ao iniciar, o servidor imprime os endereços onde a interface web está disponível — `Local` (mesma máquina) e `Network` (seu IP na LAN, ex.: `http://192.168.1.50:8080`). Use o endereço de rede para abrir o Folderlan de outros dispositivos.

---

## Acesso de outros dispositivos (LAN)

1. Encontre o IP do servidor na rede — o jeito mais fácil: copie da URL **Network** impressa na inicialização.
2. De qualquer dispositivo no mesmo Wi‑Fi, abra `http://<ip‑do‑servidor>:8080` no navegador.
3. Visitantes entram com contas criadas pelo proprietário (seção Users do painel).
4. Para criar contas de visitante, entre como proprietário → **Users** → *Create user* e defina as permissões (upload, excluir arquivos próprios, cota de armazenamento).

> [!TIP]
> No Windows, libere a porta no firewall (`netsh advfirewall firewall add rule name="Folderlan" dir=in action=allow protocol=TCP localport=8080`) para que outros dispositivos possam se conectar.

---

## Implantação como nuvem privada (VPS)

Qualquer coisa que possa executar o binário Linux e seja alcançável pela internet serve — um VPS alugado, um PC antigo em casa com encaminhamento de portas ou um Raspberry Pi.

Você precisa de:
- Um domínio (ou apenas o IP do servidor).
- Um proxy reverso (ex.: Nginx ou Caddy) para terminar o HTTPS — *fortemente recomendado*.
- Opcionalmente, systemd para manter o servidor em execução.

> [!CAUTION]
> Não exponha o Folderlan à internet sem um proxy reverso + HTTPS. Senhas e transferências de arquivos viajariam em texto puro. Os endpoints de configuração embutidos são protegidos por `LOCAL_ONLY` — mantenha essa proteção até o proxy estar no ar, e só então defina `LOCAL_ONLY=false`.

### Passo 1 — Configurar as variáveis de ambiente

Defina antes do primeiro uso. No mínimo `SECRET_JWT`, `LOCAL_ONLY=false` e (opcionalmente) `OFF_CORS=true`:

```bash
export PORT=8080
export ADDRESS=0.0.0.0
export SECRET_JWT="$(openssl rand -hex 32)"   # preserve esse valor!
export LOCAL_ONLY=false                        # os endpoints de configuração ficam acessíveis pelo proxy
export OFF_CORS=true                           # atrás de um proxy reverso, relaxa o CORS para o origin do proxy
```

> [!IMPORTANT]
> `SECRET_JWT` assina seus tokens de autenticação. Se não for definida, uma **chave aleatória é gerada a cada inicialização**, invalidando todas as sessões existentes após um reinício. Gere uma vez e guarde.

### Passo 2 — Executar como serviço systemd (Linux)

<details>
<summary><strong>Arquivo de unidade systemd completo</strong></summary>

Crie `/etc/systemd/system/folderlan.service`:

```ini
[Unit]
Description=Folderlan file-sharing server
After=network.target

[Service]
Type=simple
User=folderlan
WorkingDirectory=/opt/folderlan
Environment=SECRET_JWT=REPLACE_WITH_YOUR_SECRET
Environment=LOCAL_ONLY=false
Environment=OFF_CORS=true
ExecStart=/opt/folderlan/folderlan
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now folderlan
```

</details>

### Passo 3 — Proxy reverso com HTTPS

<details>
<summary><strong>Exemplo de configuração do Nginx</strong></summary>

```nginx
server {
    listen 443 ssl;
    server_name files.example.com;

    ssl_certificate     /etc/letsencrypt/live/files.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/files.example.com/privkey.pem;

    client_max_body_size 0;   # permite uploads grandes; o servidor os transmite em streaming

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}

server {
    listen 80;
    server_name files.example.com;
    return 301 https://$host$request_uri;
}
```

</details>

### Passo 4 — Primeira execução no servidor

1. Inicie o serviço e abra `https://files.example.com` **no servidor** (ou use o proxy) para concluir a configuração e registrar o proprietário.
2. `LOCAL_ONLY=false` permite que o endpoint de configuração seja acessado pelo seu domínio depois que o proxy estiver ativo.
3. Crie contas de visitante, defina cotas e compartilhe.

> [!NOTE]
> Faça backup da pasta `db/` (banco de dados SQLite) e de `uploads/` (seus arquivos) para recuperação de desastres — juntas, elas são toda a sua instância.

---

## Configuração

<details>
<summary><strong>Variáveis de ambiente — servidor</strong></summary>

| Variável      | Tipo   | Padrão            | Descrição |
|---------------|--------|-------------------|-----------|
| `PORT`        | u16    | `8080`            | Porta TCP para vinculação. |
| `ADDRESS`     | string | `0.0.0.0`         | Endereço de vinculação. Use `127.0.0.1` para exposição somente local. |
| `SQLITE_FILE` | string | `db/app.db`       | Caminho do banco de dados SQLite. Os diretórios pai são criados automaticamente. |
| `SECRET_JWT`  | string | *hex aleatório*   | Chave de assinatura JWT (HS256). Se não definida, uma nova chave aleatória é gerada **a cada inicialização**, invalidando todos os tokens. Defina para persistência. |
| `OFF_CORS`    | bool   | `false`           | `true` → permite todos os origins; `false` → restringe a `http://{ADDRESS}:{PORT}` com `GET, POST, DELETE, PATCH, OPTIONS` e cabeçalhos `Content-Type, Authorization`. |
| `LOCAL_ONLY`  | bool   | `true`            | Quando `true`, os endpoints de configuração/recuperação do proprietário aceitam requisições apenas de `127.0.0.1` / `::1`. Defina `false` atrás de um proxy reverso. |

</details>

<details>
<summary><strong>Variáveis de ambiente — file watcher</strong></summary>

Ajustam o monitor que observa `uploads/` em tempo real.

| Variável                      | Tipo   | Padrão            | Descrição |
|-------------------------------|--------|-------------------|-----------|
| `WATCHER_IGNORE_TTL_SECS`     | u64    | `30`              | Segundos em que um arquivo recém‑processado é ignorado (deduplicação). |
| `WATCHER_STABILITY_CHECK_MS`  | u64    | `300`             | Intervalo entre verificações de tamanho enquanto aguarda um arquivo parar de crescer. |
| `WATCHER_STABILITY_REQUIRED`  | usize  | `3`               | Verificações consecutivas de tamanho estável antes de um arquivo ser considerado totalmente gravado. |
| `WATCHER_LOCK_TTL_SECS`       | u64    | `300`             | Tempo de vida de locks por arquivo em repouso. |
| `WATCHER_PRUNE_INTERVAL_SECS` | u64    | `10`              | Intervalo para limpeza de estruturas internas. |
| `WATCHER_CHANNEL_CAPACITY`    | usize  | `64`              | Tamanho do buffer do canal interno de eventos. |

Para sistemas de arquivos lentos ou remotos (NFS, SMB), aumente os valores de estabilidade para evitar registrar arquivos parcialmente gravados.

</details>

---

## Como funciona

<details>
<summary><strong>Visão geral da arquitetura</strong></summary>

```
┌────────────────────────────── Folderlan binary ─────────────────────────────┐
│                                                                            │
│   React SPA (embedded, served on the same origin)                          │
│        │  HTTP / JSON (REST API)                                           │
│   Actix‑web API ──▶ Auth (JWT + Argon2)                                    │
│        │              Users & roles & quotas                               │
│        │              Files & permissions                                  │
│        │              Audit log                                            │
│        ▼                                                                    │
│   SQLite (metadata)    uploads/ (files)    File System Watcher ──▶ auto‑reg │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Um binário, um origin.** A interface web é compilada no binário do servidor e servida no mesmo endereço da API — sem servidor web separado, sem CORS em produção.
- **Arquivos em disco, metadados no SQLite.** Os arquivos físicos ficam em `uploads/`, com nomes higienizados e deduplicação automática `name (1).ext` em caso de colisão; o banco de dados rastreia nomes, tamanhos, propriedade, visibilidade e permissões.
- **O watcher os mantém sincronizados.** Arquivos colocados em `uploads/` por outros meios são registrados automaticamente (pertencentes à conta do proprietário); arquivos excluídos do disco são marcados automaticamente como excluídos. Uma verificação de estabilidade garante que arquivos parcialmente gravados nunca sejam registrados.
- **As permissões são avaliadas a cada requisição.** O proprietário ignora tudo; arquivos públicos são visíveis; autores sempre veem seus próprios arquivos; concessões explícitas (`viewer`/`collaborator`) desbloqueiam ações específicas — todo o resto retorna `403`.

</details>

---

## Segurança e privacidade

<details>
<summary><strong>O que está protegido, e como</strong></summary>

- **Senhas:** hash com **Argon2** (memory‑hard) — nunca armazenadas em texto puro.
- **Sessões:** tokens **JWT** de curta duração (1 hora) assinados com seu `SECRET_JWT`.
- **Superfície de inicialização:** criação do banco de dados, registro do proprietário e redefinição de senha do proprietário são **somente locais** por padrão.
- **Modelo de exclusão:** usuários e arquivos são **excluídos suavemente** — reversível pelo proprietário até a remoção física.
- **Registro de auditoria:** quem, o quê, quando, de qual IP e se teve sucesso.
- **Seus dados:** todos os arquivos permanecem na sua máquina. Sem telemetria, sem armazenamento de terceiros.

</details>

---

## Compilar a partir do código-fonte

<details>
<summary><strong>Requisitos</strong></summary>

As seguintes ferramentas são necessárias para que os scripts de compilação funcionem corretamente. As versões mostradas são as recomendadas e testadas; versões semelhantes devem funcionar.

- **Rust 1.96.0** ou superior
- **NodeJS 24.16.0** ou superior
- **PNPM 11.6.0** ou superior

</details>

<details>
<summary><strong>Etapas de compilação</strong></summary>

1. **Clone o repositório:**
   ```bash
   git clone --depth 1 https://github.com/ImMau14/Folderlan.git
   ```

2. **Compile o projeto** — o script instala as dependências do frontend, compila o app React, copia para `backend/dist/` e compila o backend Rust (que embute o frontend):
   ```bash
   # No Linux ou Git‑Bash
   bash scripts/build.sh

   # No Windows (Prompt de comando)
   scripts/build.cmd

   # No Windows (PowerShell)
   ./scripts/build.ps1
   ```

   Adicione a flag `--release` para um binário Rust otimizado:
   ```bash
   bash scripts/build.sh --release
   ```

3. **Execute:**
   ```bash
   cd backend
   cargo run --release
   # ou, se compilou sem --release:
   cargo run
   ```

4. Abra `http://localhost:8080` e conclua a configuração inicial.

</details>

---

## Manutenção

O Folderlan é um **projeto pessoal** criado para resolver uma necessidade pessoal e
mantido no tempo livre. É estável, mas issues e pull requests podem demorar para
receber resposta. Relatórios de bugs e problemas de segurança são tratados pelos
[modelos de issue](.github/ISSUE_TEMPLATE/) e pela [política de segurança](SECURITY.md)
— as expectativas devem estar alinhadas a um projeto de hobby com um único
mantenedor.

---

## Licença

Este projeto é licenciado sob a Licença MIT — consulte o arquivo [LICENSE](LICENSE) para detalhes.
