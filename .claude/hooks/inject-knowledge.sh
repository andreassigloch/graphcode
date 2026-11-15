#!/bin/bash
# CR-GC-935 — SessionStart/SubagentStart hook: put the repo's knowledge file into the agent context.
#
# Not a deny hook and not registered by this package's own settings.json: `graphcode init|update`
# copies it and registers it only when `graphcode.config.jsonc` names a file under `knowledgeFile`.
# The registered command passes that absolute path as $1.
# Claude Code caps a hook's context at 10 000 characters and would cut the rest to a preview.
# So: a file within the cap goes out whole; a larger or missing file yields ONE sentence, no excerpt.
# Protocol: event JSON on stdin; JSON with hookSpecificOutput.additionalContext on stdout; always exit 0.

MAX=10000
file="$1"
event=$(jq -r '.hook_event_name // empty' 2>/dev/null)
[ -z "$event" ] && event="SessionStart"

if [ -z "$file" ] || [ ! -f "$file" ]; then
  jq -n --arg ev "$event" --arg f "$file" \
    '{hookSpecificOutput:{hookEventName:$ev,additionalContext:("graphcode: Wissensdatei \($f) fehlt, es wurde nichts eingebunden.")}}'
  exit 0
fi

jq -n --arg ev "$event" --arg f "$file" --argjson max "$MAX" --rawfile c "$file" \
  '{hookSpecificOutput:{hookEventName:$ev,additionalContext:(if ($c|length) > $max then "graphcode: Wissensdatei \($f) hat \($c|length) Zeichen und ist damit größer als \($max), es wurde nichts eingebunden." else $c end)}}'
exit 0
