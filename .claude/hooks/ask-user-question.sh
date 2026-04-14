#!/bin/bash
# Hook PreToolUse - Intercepta AskUserQuestion e pausa para interação do usuário
# Le config de /workspace/.lasy/config.json

set -e

# LOG: Recebendo input
echo "[ask-user-question] Hook iniciado" >&2

INPUT=$(cat)
echo "[ask-user-question] Input recebido: $INPUT" >&2

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
echo "[ask-user-question] Tool name: $TOOL_NAME" >&2

# Se não for AskUserQuestion, permite execução normal
if [ "$TOOL_NAME" != "AskUserQuestion" ]; then
  echo "[ask-user-question] Não é AskUserQuestion, permitindo execução" >&2
  exit 0
fi

echo "[ask-user-question] ✅ Interceptando AskUserQuestion!" >&2

CONFIG_FILE="/workspace/.lasy/config.json"

# Verificar se arquivo de config existe
if [ ! -f "$CONFIG_FILE" ]; then
  echo "[ask-user-question] ❌ Config file not found: $CONFIG_FILE" >&2
  exit 2
fi
echo "[ask-user-question] ✅ Config file found" >&2

# Verificar se jq esta disponivel
if ! command -v jq &> /dev/null; then
  echo "[ask-user-question] ❌ jq not found" >&2
  exit 2
fi
echo "[ask-user-question] ✅ jq available" >&2

# Extrair dados do config e do tool_input
PROJECT_ID=$(jq -r '.projectId // empty' "$CONFIG_FILE")
SESSION_ID=$(jq -r '.sessionId // empty' "$CONFIG_FILE")
TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input')

echo "[ask-user-question] PROJECT_ID: $PROJECT_ID" >&2
echo "[ask-user-question] SESSION_ID: $SESSION_ID" >&2
echo "[ask-user-question] TOOL_INPUT: $TOOL_INPUT" >&2

# Validar campos obrigatorios
if [ -z "$PROJECT_ID" ] || [ -z "$SESSION_ID" ]; then
  echo "[ask-user-question] ❌ Missing projectId or sessionId in config" >&2
  exit 2
fi

# Salvar pergunta em arquivo temporário
echo "[ask-user-question] Salvando pergunta em /tmp/lasy-question.json..." >&2
jq -n \
  --argjson toolInput "$TOOL_INPUT" \
  --arg projectId "$PROJECT_ID" \
  --arg sessionId "$SESSION_ID" \
  '{
    projectId: $projectId,
    sessionId: $sessionId,
    questions: $toolInput.questions,
    title: $toolInput.title,
    timestamp: (now | todate)
  }' > /tmp/lasy-question.json

if [ -f /tmp/lasy-question.json ]; then
  echo "[ask-user-question] ✅ Arquivo criado com sucesso!" >&2
  echo "[ask-user-question] Conteúdo:" >&2
  cat /tmp/lasy-question.json >&2
else
  echo "[ask-user-question] ❌ Falha ao criar arquivo!" >&2
  exit 2
fi

# Aguardar resposta (polling com timeout de 10 minutos)
echo "[ask-user-question] 🔄 Aguardando resposta do usuário..." >&2
TIMEOUT=600
ELAPSED=0
SLEEP_INTERVAL=2

while [ $ELAPSED -lt $TIMEOUT ]; do
  if [ -f /tmp/lasy-answer.json ]; then
    echo "[ask-user-question] ✅ Resposta recebida!" >&2
    break
  fi
  
  # Log a cada 10 segundos
  if [ $((ELAPSED % 10)) -eq 0 ]; then
    echo "[ask-user-question] ⏳ Aguardando... ($ELAPSED/$TIMEOUT segundos)" >&2
  fi
  
  sleep $SLEEP_INTERVAL
  ELAPSED=$((ELAPSED + SLEEP_INTERVAL))
done

# Verificar se resposta foi recebida
if [ ! -f /tmp/lasy-answer.json ]; then
  echo "[ask-user-question] ❌ Timeout waiting for answer ($TIMEOUT seconds)" >&2
  rm -f /tmp/lasy-question.json
  exit 2
fi

# Ler resposta (formato: { "questions": [ { "id": "question-0", "answer": ["React"] } ] })
echo "[ask-user-question] Lendo resposta..." >&2
ANSWERS=$(cat /tmp/lasy-answer.json)
echo "[ask-user-question] Resposta lida: $ANSWERS" >&2

# Limpar arquivos temporários
rm -f /tmp/lasy-question.json
rm -f /tmp/lasy-answer.json
echo "[ask-user-question] ✅ Arquivos temporários removidos" >&2

# Ler debug logs se o usuário enviou junto (Enviar + Logs)
DEBUG_LOGS=""
if [ -f /tmp/lasy-debug-logs.txt ]; then
  DEBUG_LOGS=$(cat /tmp/lasy-debug-logs.txt)
  rm -f /tmp/lasy-debug-logs.txt
  echo "[ask-user-question] ✅ Debug logs incluídos no additionalContext" >&2
fi

echo "[ask-user-question] 📤 Retornando resposta para Claude (additionalContext)" >&2

# Objeto { "question-0": ["React"], ... } para o modelo via additionalContext (é assim que as respostas chegam ao Claude)
ANSWERS_OBJ=$(echo "$ANSWERS" | jq -c '.questions | map({(.id): .answer}) | add // {}')
jq -n \
  --arg answersObj "$ANSWERS_OBJ" \
  --arg debugLogs "$DEBUG_LOGS" \
  '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "User answered questions",
      additionalContext: ("User answered: " + $answersObj + (if ($debugLogs | length) > 0 then "\n\nDebug panel logs:\n" + $debugLogs else "" end))
    }
  }'

exit 0