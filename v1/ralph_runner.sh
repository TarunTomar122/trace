#!/bin/bash
# Ralph Wiggum Runner for Trace v1 Implementation
# This script runs an AI agent in a loop to complete microtasks

set -e

PHASE=${1:-1}
MAX_ITERATIONS=${2:-20}
TASK_FILE="phase${PHASE}_tasks.json"

echo "=== Ralph Runner for Trace v1 ==="
echo "Phase: $PHASE"
echo "Max iterations: $MAX_ITERATIONS"
echo "Task file: $TASK_FILE"
echo ""

if [ ! -f "$TASK_FILE" ]; then
    echo "❌ Task file not found: $TASK_FILE"
    exit 1
fi

# Check for completion promise
check_completion() {
    local phase=$1
    local promise="<promise>PHASE${phase}_COMPLETE</promise>"
    
    if [ -f "progress.json" ]; then
        if grep -q "$promise" progress.json; then
            return 0
        fi
    fi
    return 1
}

# Initialize progress if not exists
if [ ! -f "progress.json" ]; then
    echo '{"phase": '$PHASE', "iteration": 0, "completed_tasks": [], "status": "in_progress"}' > progress.json
fi

echo "🚀 Starting Ralph loop..."
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
    echo "--- Iteration $i/$MAX_ITERATIONS ---"
    
    # Check if phase is complete
    if check_completion $PHASE; then
        echo "✅ Phase $PHASE complete! Found completion promise."
        exit 0
    fi
    
    # Update iteration count
    jq ".iteration = $i" progress.json > progress.tmp && mv progress.tmp progress.json
    
    # Here you would call your AI agent
    # For now, this is a placeholder for the actual agent invocation
    echo "ℹ️  Run your AI agent here with:"
    echo "   - Read: v1/$TASK_FILE"
    echo "   - Read: v1/CONTEXT.md"
    echo "   - Read: v1/progress.json"
    echo "   - Work on next incomplete task"
    echo "   - Update progress.json"
    echo "   - When done, write: <promise>PHASE${PHASE}_COMPLETE</promise>"
    echo ""
    
    # In a real Ralph loop, you'd pipe this to Claude/GPT here
    # Example: cat v1/$TASK_FILE v1/CONTEXT.md v1/progress.json | your_ai_command
    
    # For manual mode, wait for user to complete task
    read -p "Press Enter when task is complete (or Ctrl+C to stop)..."
    
    # Run verification if available
    echo "🧪 Running verifications..."
    # This would check verification_command from task JSON
    
    echo ""
done

echo "⚠️  Max iterations reached. Phase may not be complete."
exit 1

