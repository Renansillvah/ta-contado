#!/bin/bash
# Hook PreToolUse - Intercepta ExitPlanMode e pausa para aprovacao do usuario
# O Claude chama ExitPlanMode ao terminar o plano no plan mode nativo do CLI
# tool_input contem: title, summary, plan/content, steps, considerations, tradeoffs

# NAO usar set -e para evitar saida prematura em comandos opcionais

echo "[approve-plan] Hook iniciado" >&2

INPUT=$(cat)
echo "[approve-plan] Input recebido (primeiros 500 chars): $(echo "$INPUT" | head -c 500)" >&2

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
echo "[approve-plan] Tool name: $TOOL_NAME" >&2

# Se nao for ExitPlanMode, permite execucao normal
if [ "$TOOL_NAME" != "ExitPlanMode" ]; then
  echo "[approve-plan] Nao e ExitPlanMode, permitindo execucao" >&2
  exit 0
fi

echo "[approve-plan] Interceptando ExitPlanMode!" >&2

CONFIG_FILE="/workspace/.lasy/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "[approve-plan] Config file not found: $CONFIG_FILE" >&2
  exit 2
fi

if ! command -v jq &> /dev/null; then
  echo "[approve-plan] jq not found" >&2
  exit 2
fi

PROJECT_ID=$(jq -r '.projectId // empty' "$CONFIG_FILE" 2>/dev/null || echo "")
SESSION_ID=$(jq -r '.sessionId // empty' "$CONFIG_FILE" 2>/dev/null || echo "")

echo "[approve-plan] PROJECT_ID: $PROJECT_ID" >&2

if [ -z "$PROJECT_ID" ] || [ -z "$SESSION_ID" ]; then
  echo "[approve-plan] Missing projectId or sessionId in config" >&2
  exit 2
fi

# Extrair dados do tool_input (ExitPlanMode passa o plano completo)
TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input // {}' 2>/dev/null || echo "{}")
echo "[approve-plan] TOOL_INPUT extraido" >&2

# Titulo do plano (de tool_input.title ou fallback)
PLAN_TITLE=$(echo "$TOOL_INPUT" | jq -r '.title // "Implementation Plan"' 2>/dev/null || echo "Implementation Plan")
# Resumo do plano (de tool_input.summary ou tool_input.plan_summary)
SUMMARY=$(echo "$TOOL_INPUT" | jq -r '.summary // .plan_summary // ""' 2>/dev/null || echo "")
# Conteudo completo do plano (plan ou content)
PLAN_CONTENT=$(echo "$TOOL_INPUT" | jq -r '.plan // .content // ""' 2>/dev/null || echo "")

echo "[approve-plan] PLAN_TITLE: $PLAN_TITLE" >&2
echo "[approve-plan] SUMMARY (primeiros 100 chars): $(echo "$SUMMARY" | head -c 100)" >&2

# Salvar plano em docs/plans/ como .md (para o usuario visualizar no painel de arquivos)
PLAN_NAME="$PLAN_TITLE"
PLAN_FILENAME=$(echo "$PLAN_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
if [ -z "$PLAN_FILENAME" ]; then
  PLAN_FILENAME="plan-$(date +%s)"
fi

mkdir -p /workspace/docs/plans
PLAN_FILE="/workspace/docs/plans/$PLAN_FILENAME.md"

# Montar conteudo do .md a partir do tool_input
{
  echo "# $PLAN_TITLE"
  echo ""
  if [ -n "$SUMMARY" ]; then
    echo "## Resumo"
    echo "$SUMMARY"
    echo ""
  fi
  if [ -n "$PLAN_CONTENT" ]; then
    echo "$PLAN_CONTENT"
  fi
} > "$PLAN_FILE"

PLAN_PATH="docs/plans/$PLAN_FILENAME.md"
echo "[approve-plan] Plano salvo em: $PLAN_PATH" >&2

# Salvar info do plano em arquivo temporario
echo "[approve-plan] Salvando plano em /tmp/lasy-plan.json..." >&2
jq -n \
  --arg projectId "$PROJECT_ID" \
  --arg sessionId "$SESSION_ID" \
  --arg planPath "$PLAN_PATH" \
  --arg planName "$PLAN_NAME" \
  --arg summary "$SUMMARY" \
  --arg planContent "$PLAN_CONTENT" \
  '{
    projectId: $projectId,
    sessionId: $sessionId,
    planPath: $planPath,
    planName: $planName,
    summary: $summary,
    planContent: $planContent,
    timestamp: (now | todate)
  }' > /tmp/lasy-plan.json

echo "[approve-plan] Arquivo criado com sucesso!" >&2

# Aguardar resposta (polling com timeout de 10 minutos)
echo "[approve-plan] Aguardando decisao do usuario..." >&2
TIMEOUT=600
ELAPSED=0
SLEEP_INTERVAL=2

while [ $ELAPSED -lt $TIMEOUT ]; do
  if [ -f /tmp/lasy-plan-answer.json ]; then
    echo "[approve-plan] Decisao recebida!" >&2
    break
  fi

  if [ $((ELAPSED % 10)) -eq 0 ]; then
    echo "[approve-plan] Aguardando... ($ELAPSED/$TIMEOUT segundos)" >&2
  fi

  sleep $SLEEP_INTERVAL
  ELAPSED=$((ELAPSED + SLEEP_INTERVAL))
done

if [ ! -f /tmp/lasy-plan-answer.json ]; then
  echo "[approve-plan] Timeout aguardando decisao ($TIMEOUT segundos)" >&2
  rm -f /tmp/lasy-plan.json
  exit 2
fi

ANSWER=$(cat /tmp/lasy-plan-answer.json)
ACTION=$(echo "$ANSWER" | jq -r '.action // "rejected"')
FEEDBACK=$(echo "$ANSWER" | jq -r '.feedback // ""' 2>/dev/null || echo "")
echo "[approve-plan] Acao do usuario: $ACTION" >&2
echo "[approve-plan] Feedback: $FEEDBACK" >&2

# Limpar arquivos temporarios
rm -f /tmp/lasy-plan.json
rm -f /tmp/lasy-plan-answer.json
echo "[approve-plan] Arquivos temporarios removidos" >&2

echo "[approve-plan] Retornando decisao para Claude (additionalContext)" >&2

if [ "$ACTION" = "approved" ]; then
  if [ -n "$PLAN_PATH" ]; then
    jq -n \
      --arg planPath "$PLAN_PATH" \
      --arg feedback "$FEEDBACK" \
      '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: "User approved the plan",
          additionalContext: ("The user APPROVED this plan. Now implement all the steps described in " + $planPath + ". Read the file and execute each step completely." + (if ($feedback | length) > 0 then " Additional user notes: " + $feedback else "" end))
        }
      }'
  else
    jq -n \
      --arg feedback "$FEEDBACK" \
      '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: "User approved the plan",
          additionalContext: ("The user APPROVED this plan. Now implement all the steps you outlined. Execute each step completely." + (if ($feedback | length) > 0 then " Additional user notes: " + $feedback else "" end))
        }
      }'
  fi
elif [ "$ACTION" = "feedback" ]; then
  jq -n \
    --arg planPath "$PLAN_PATH" \
    --arg feedback "$FEEDBACK" \
    '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "User requested plan revision",
        additionalContext: ("The user wants to REVISE the plan before approving. User feedback: " + $feedback + ". Please update the plan file" + (if ($planPath | length) > 0 then " at " + $planPath else "" end) + " based on this feedback, then call ExitPlanMode again so the user can review.")
      }
    }'
else
  jq -n \
    --arg feedback "$FEEDBACK" \
    '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "User rejected the plan",
        additionalContext: ("The user REJECTED this plan. Do not implement it." + (if ($feedback | length) > 0 then " User feedback: " + $feedback + " Revise the approach and ask the user what they would like instead." else " Ask the user what they would like to change." end))
      }
    }'
fi

exit 0