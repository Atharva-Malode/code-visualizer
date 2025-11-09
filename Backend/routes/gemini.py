from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, validator
import json, logging, os, re
from typing import Optional, Dict, Any
from google import genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("gemini")
logger.setLevel(logging.INFO)

api_key = os.getenv("GEMINI_API_KEY")     
client = None
try:
    if api_key:
        client = genai.Client(api_key=api_key)
        logger.info("✅ Gemini client successfully configured.")
    else:
        logger.warning("⚠️ GEMINI_API_KEY not found.")
except Exception as e:
    logger.error(f"❌ Error initializing Gemini client: {str(e)}")
    client = None


# ============================================================
# Constants
# ============================================================

SUPPORTED_PATTERNS = [
    "array", "linkedList", "binaryTree", "graph", "matrix", "stack", "queue"
]

SUPPORTED_STRUCTURE_TYPES = [
    "array", "linkedlist", "stack", "queue", "binarytree", "graph", "matrix"
]

SUPPORTED_ACTIONS = [
    "visit", "compare", "swap", "mark", "push", "pop", "enqueue",
    "dequeue", "pointerMove", "update", "connect", "disconnect",
    "create", "delete"
]


# ============================================================
# Models
# ============================================================

class InputModel(BaseModel):
    prompt: str = Field(..., min_length=10, max_length=5000)

    @validator("prompt")
    def validate_prompt(cls, v):
        v = v.strip()
        if len(v) < 10:
            raise ValueError("Prompt must be at least 10 characters long")
        return v


class ResponseModel(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None
    message: Optional[str] = None


# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api", tags=["DSA Visualizer"])


# ============================================================
# Helper Functions
# ============================================================

def detect_input_type(prompt: str) -> str:
    """Detect if input is code or question"""
    code_keywords = [
        "def ", "class ", "public ", "private ", "static ", "#include",
        "int main", "function", "=>", "return ", "for ", "while ", "{", "}"
    ]
    for k in code_keywords:
        if k in prompt:
            return "code"
    return "question"


def clean_json_response(text: str) -> str:
    """Strip markdown and extract JSON"""
    text = text.strip()
    if text.startswith("```"):
        match = re.search(r'```(?:json)?\n?(.*?)\n?```', text, re.DOTALL)
        if match:
            text = match.group(1)
    if text.startswith("json"):
        text = text[len("json"):].strip()
    last = text.rfind("}")
    if last > 0:
        text = text[:last+1]
    return text


def build_prompt(prompt: str, input_type: str, pattern_hint: Optional[str] = None) -> str:
    """
    🧠 Simplified DSA Visualization Prompt Generator
    - Works with Gemini & GPT models
    - Ensures consistent, valid JSON
    - Supports all major DSA pattern types
    - Includes clear pointer highlighting rules for linked lists
    """

    pattern_hint = (pattern_hint or "auto-detect").lower()

    # ============================================================
    # UNIVERSAL BASE SCHEMA (kept short + readable)
    # ============================================================
    base_schema = """
You are a DSA Visualization Engine.

🎯 Your task:
Given a DSA problem or code snippet, generate a single valid JSON object that describes
how data structures change step-by-step as the algorithm executes.

Each step must include:
- The action being performed (visit, compare, swap, connect, update, etc.)
- The elements affected (indices or nodes)
- A short explanation of what happens
- The full updated state of all data structures in that step

Return ONLY valid JSON (no markdown, no explanations outside JSON).

Use this JSON format:

{
  "questionName": "string",
  "patternType": "array | linkedlist | graph | binarytree | matrix | stack | queue",
  "sampleInput": {},
  "sampleOutput": {},
  "visualLayout": {
    "structures": [
      {
        "id": "structure_id",
        "type": "array | linkedlist | graph | variable | stack | queue | matrix | result",
        "label": "Display name",
        "data": [],
        "connections": [],
        "value": null
      }
    ]
  },
  "steps": [
    {
      "step": 1,
      "action": "visit | update | push | pop | connect | pointerMove | compare",
      "elements": [],
      "highlight": [],
      "message": "Explain what happens in this step",
      "stateChange": {
        "structure_id": {
          "data": [],
          "connections": []
        },
        "variables": {}
      }
    }
  ],
  "endMessage": "Final explanation of what happened."
}
"""

    # ============================================================
    # PATTERN-SPECIFIC HINTS (concise)
    # ============================================================
    pattern_hints = {
        "array": "Show index movements, swaps, or updates at each step.",
        "linkedlist": (
            "Show how pointers (prev, curr, next, head, tail) move and how the list connections change. "
            "Each step should include the current state of the list, even if unchanged."
        ),
        "graph": "Show node visits, edge traversals, and updates to visited arrays or recursion stacks.",
        "binarytree": "Show node visits (preorder/inorder/postorder) and recursive steps clearly.",
        "matrix": "Show changes to cell values or traversal order in a 2D grid.",
        "stack": "Show push/pop operations and current stack content after each step.",
        "queue": "Show enqueue/dequeue operations and queue state after each step."
    }

    pattern_instruction = pattern_hints.get(pattern_hint, "")

    # ============================================================
    # LINKED LIST POINTER RULES (for highlight consistency)
    # ============================================================
    pointer_highlight_rule = """
📍 Highlight Rule for Linked Lists:
When representing pointers such as prev, curr, next, head, or tail,
use this structured format inside 'highlight':

  { "structure": "linked_list", "node": "node_2", "label": "curr_ptr" }

If the pointer is null or not pointing to any node, represent it as:
  { "structure": "variable", "label": "curr_ptr", "node": null }

This allows the visualizer to correctly map pointer variables to list nodes.
"""

    # ============================================================
    # FINAL USER INSTRUCTION SECTION
    # ============================================================
    user_section = f"""
Problem or code snippet to visualize:
{prompt}

Detected input type: {input_type}
Pattern hint: {pattern_hint}

Follow the JSON format above.
Ensure every step includes the updated state of all structures (even if unchanged).
{pattern_instruction}

{pointer_highlight_rule}

Return only the valid JSON (no markdown or text outside the JSON).
"""

    # ============================================================
    # ASSEMBLE FINAL PROMPT
    # ============================================================
    final_prompt = base_schema + "\n" + user_section.strip()
    return final_prompt




@router.post("/generate-visualization", response_model=ResponseModel)
async def generate_visualization(input_data: InputModel):
    """
    Main route: Converts DSA question/code into universal visualization JSON.
    
    Supports:
    - Arrays (1D, 2D DP)
    - LinkedLists (all types)
    - BinaryTrees
    - Graphs
    - Matrices
    - Stacks
    - Queues
    """
    try:
        if not client:
            raise HTTPException(
                status_code=503,
                detail="Gemini client not configured"
            )

        input_type = detect_input_type(input_data.prompt)
        full_prompt = build_prompt(input_data.prompt, input_type)

        logger.info(f"Processing {input_type} input...")

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=full_prompt
        )

        if not response or not response.text:
            raise HTTPException(
                status_code=500,
                detail="Empty response from Gemini"
            )

        cleaned = clean_json_response(response.text)
        print(f"Cleaned JSON: {cleaned}")
        try:
            result = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            raise HTTPException(
                status_code=422,
                detail=f"Invalid JSON: {e}"
            )

        logger.info(f"✅ Generated visualization for {result.get('questionName')}")

        return ResponseModel(
            success=True,
            data=result,
            message=f"Visualization generated from {input_type} input"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health():
    """Service health check"""
    return {
        "status": "healthy",
        "gemini_configured": client is not None,
        "supported_patterns": SUPPORTED_PATTERNS,
        "supported_structures": SUPPORTED_STRUCTURE_TYPES,
        "supported_actions": SUPPORTED_ACTIONS
    }


@router.get("/supported-patterns")
async def get_supported_patterns():
    """Get supported patterns and structures"""
    return {
        "success": True,
        "patterns": SUPPORTED_PATTERNS,
        "structures": SUPPORTED_STRUCTURE_TYPES,
        "actions": SUPPORTED_ACTIONS,
        "description": {
            "array": "1D arrays, sorting, searching, DP 1D",
            "linkedList": "Singly, doubly, circular linked lists",
            "binaryTree": "Tree traversals, construction, queries",
            "graph": "BFS, DFS, shortest path, topological sort",
            "matrix": "2D grids, matrix operations, DP 2D",
            "stack": "DFS, expression evaluation",
            "queue": "BFS, level order, scheduling"
        }
    }


@router.get("/schema")
async def get_schema():
    """Get schema template"""
    return {
        "success": True,
        "data": {
            "questionName": "Problem name",
            "patternType": "array | linkedList | binaryTree | graph | matrix | stack | queue",
            "sampleInput": {},
            "sampleOutput": {},
            "visualLayout": {
                "structures": [
                    {
                        "id": "unique_id",
                        "type": "array | linkedlist | stack | queue | binarytree | graph | matrix",
                        "label": "Label",
                        "data": [],
                        "value": None
                    }
                ]
            },
            "steps": [
                {
                    "step": 1,
                    "action": "visit | compare | swap | update",
                    "highlight": [{"structureId": "id", "indices": [0]}],
                    "message": "Step explanation",
                    "condition": {"expression": "condition", "result": True},
                    "stateChange": {}
                }
            ],
            "endMessage": "Done!"
        }
    }