#!/usr/bin/env bash
set -euo pipefail

# --- Cores para o terminal ---
C_RESET='\033[0m'
C_RED='\033[0;31m'
C_GREEN='\033[0;32m'
C_YELLOW='\033[0;33m'
C_BLUE='\033[0;34m'

# --- Funções auxiliares ---
confirm() {
  local msg="$1"
  local response=""
  read -r -p "$msg (y/n) " response || true
  [[ "${response,,}" == "y" || "${response,,}" == "yes" ]]
}

default_main_branch() {
  local head
  head="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
  if [[ -n "$head" && "$head" == origin/* ]]; then
    echo "${head#origin/}"
  else
    echo "main"
  fi
}

push_branch() {
  local branch="$1"
  git push -u origin "$branch"
}

# --- Pré-cheques ---
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo -e "${C_RED}ERRO: Não está em um repositório Git.${C_RESET}"
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
MAIN_BRANCH="$(default_main_branch)"
SRC_BRANCH="$CURRENT_BRANCH"

echo -e "${C_BLUE}Branch atual:${C_RESET} ${CURRENT_BRANCH}"
echo -e "${C_BLUE}Branch principal (origin/HEAD):${C_RESET} ${MAIN_BRANCH}"
echo

# --- Etapa 1: add + status + commit ---
echo "Adicionando mudanças (git add .)..."
git add .

echo
echo -e "${C_BLUE}Status após 'git add':${C_RESET}"
git status

if git diff --cached --quiet; then
  echo
  echo -e "${C_YELLOW}Nenhum arquivo staged para commit. Continuando...${C_RESET}"
else
  echo
  read -r -p "Mensagem do commit: " COMMIT_MSG
  if [[ -z "${COMMIT_MSG// }" ]]; then
    echo -e "${C_RED}Mensagem de commit vazia. Abortando.${C_RESET}"
    exit 1
  fi
  git commit -m "$COMMIT_MSG"
  echo -e "${C_GREEN}Commit criado com sucesso em '${CURRENT_BRANCH}'.${C_RESET}"
fi

# --- Etapa 1.5: opcional push da branch atual ---
echo
if confirm "Deseja enviar o branch atual '${CURRENT_BRANCH}' para o remoto (push)?"; then
  echo "Enviando '${CURRENT_BRANCH}'..."
  push_branch "${CURRENT_BRANCH}"
  echo -e "${C_GREEN}Push de '${CURRENT_BRANCH}' concluído.${C_RESET}"
else
  echo "Sem push do branch atual."
fi

# Se estiver na main, não faz sentido tentar merge main->main
echo
if [[ "${CURRENT_BRANCH}" == "${MAIN_BRANCH}" ]]; then
  echo -e "${C_YELLOW}Você está na '${MAIN_BRANCH}'. Não há branch de feature para mesclar.${C_RESET}"
  echo -e "${C_GREEN}Script concluído.${C_RESET}"
  exit 0
fi

# --- Etapa 2: opcional merge na main ---
echo
if confirm "Deseja atualizar '${MAIN_BRANCH}' com as mudanças de '${SRC_BRANCH}'?"; then
  echo -e "${C_BLUE}Iniciando processo de merge para '${MAIN_BRANCH}'...${C_RESET}"

  # --- Verificação de pastas proibidas (no branch de origem, antes de tudo) ---
  echo "Verificando se há pastas proibidas em '${SRC_BRANCH}'..."
  BLOQUEADOS=("backend-controle-portaria" "meu-frontend")
  for DIR in "${BLOQUEADOS[@]}"; do
    if git ls-tree -r --name-only "${SRC_BRANCH}" | grep -q "^${DIR}/"; then
      echo -e "${C_RED}⚠️  ERRO: A pasta '${DIR}/' está rastreada no branch '${SRC_BRANCH}' e não pode ser mesclada na main.${C_RESET}"
      echo "Para corrigir, remova-a do rastreamento neste branch com:"
      echo "  git rm -r --cached ${DIR}/ && git commit -m 'chore: remove ${DIR} do rastreamento'"
      exit 1
    fi
  done
  echo -e "${C_GREEN}Nenhuma pasta proibida encontrada.${C_RESET}"

  echo "Atualizando informações do repositório remoto..."
  git fetch --all --prune

  # --- Stash robusto (corrige o bug do --quiet que não retorna output) ---
  NEED_STASH=0
  if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files -o --exclude-standard)" ]]; then
    NEED_STASH=1
    echo "Guardando alterações locais não commitadas (stash)..."
    git stash push -u -m "git-flow.sh auto-stash" >/dev/null
  else
    echo "Nada para stash."
  fi

  echo "Trocando para o branch '${MAIN_BRANCH}'..."
  git checkout "${MAIN_BRANCH}"

  echo "Atualizando '${MAIN_BRANCH}' com a versão remota (pull --ff-only)..."
  git pull --ff-only origin "${MAIN_BRANCH}" || {
    echo -e "${C_RED}Falha ao atualizar '${MAIN_BRANCH}'. Resolva divergências antes de continuar.${C_RESET}"
    git checkout "${CURRENT_BRANCH}" >/dev/null 2>&1 || true
    exit 1
  }

  echo "Mesclando '${SRC_BRANCH}' em '${MAIN_BRANCH}' (merge --ff-only)..."
  git merge --ff-only "${SRC_BRANCH}" || {
    echo -e "${C_RED}Merge não é fast-forward.${C_RESET}"
    echo "Sugestão: faça rebase do '${SRC_BRANCH}' em '${MAIN_BRANCH}' e tente novamente:"
    echo "  git checkout ${SRC_BRANCH}"
    echo "  git rebase ${MAIN_BRANCH}"
    echo "  git checkout ${MAIN_BRANCH}"
    echo "  git merge --ff-only ${SRC_BRANCH}"
    git checkout "${CURRENT_BRANCH}" >/dev/null 2>&1 || true
    exit 1
  }

  echo -e "${C_GREEN}Branch '${MAIN_BRANCH}' atualizado com sucesso.${C_RESET}"

  # --- Etapa 3: opcional push da MAIN ---
  echo
  if confirm "Deseja enviar as alterações da '${MAIN_BRANCH}' para o repositório remoto (push)?"; then
    echo "Enviando '${MAIN_BRANCH}'..."
    push_branch "${MAIN_BRANCH}"
    echo -e "${C_GREEN}Push de '${MAIN_BRANCH}' concluído.${C_RESET}"
  else
    echo "Sem push. Tudo local."
  fi

  # Volta para o branch original
  echo "Retornando para o branch '${CURRENT_BRANCH}'..."
  git checkout "${CURRENT_BRANCH}" >/dev/null 2>&1 || true

  if [[ "${NEED_STASH}" -eq 1 ]]; then
    echo "Restaurando alterações locais (stash pop)..."
    git stash pop || echo -e "${C_YELLOW}Não foi possível aplicar o stash. Faça manualmente com 'git stash pop'.${C_RESET}"
  fi

  # --- Etapa 4: opcional deletar branch de feature ---
  echo
  if confirm "Deseja deletar o branch de feature '${SRC_BRANCH}' (local e remoto)?"; then
    echo "Trocando para '${MAIN_BRANCH}' para poder deletar o branch..."
    git checkout "${MAIN_BRANCH}"
    echo "Deletando branch local '${SRC_BRANCH}'..."
    git branch -d "${SRC_BRANCH}"
    echo "Deletando branch remoto '${SRC_BRANCH}'..."
    git push origin --delete "${SRC_BRANCH}"
    echo -e "${C_GREEN}Branch '${SRC_BRANCH}' deletado com sucesso. Você agora está em '${MAIN_BRANCH}'.${C_RESET}"
  fi

else
  echo "Operação de merge cancelada pelo usuário."
fi

echo
echo -e "${C_GREEN}Script concluído.${C_RESET}"

#Branches (onde mora o caos)
#git branch              # lista
#git branch nome         # cria
#git checkout nome       # troca
#git checkout -b nome    # cria + troca
#git merge nome          # junta
#git branch -d nome      # apaga

#it fetch --all
#git reset --hard origin/main

#Quero tudo igual ao remoto, dane-se o local

#git fetch --all
#git reset --hard origin/main

#Ver tudo que mudou (código mesmo)
#git diff main..busca-consumo

#Ver só nomes dos arquivos alterados
#git diff --name-only main..busca-consumo

#Ver resumo (quantos arquivos, linhas, etc.)
#git diff --stat main..busca-consumo

#Se quiser o inverso (o que a main tem e essa branch não):

#git diff busca-consumo..main