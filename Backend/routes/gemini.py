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


def build_prompt(prompt: str, input_type: str) -> str:
    """
    🔥 Final Gemini-compatible universal prompt for Atharva's DSA visualizer.
    Ensures outputs follow EXACT JSON schema consistent with your animation engine
    for all patterns: array, linkedList, binaryTree, graph, matrix, stack, queue.
    """

    system_prompt = """You are a DSA Visualization JSON generator for an animation engine.

🎯 YOUR ONLY GOAL:
Given any Data Structures & Algorithms problem or code,
generate a **strictly valid JSON** describing a step-by-step algorithm visualization
that follows the EXACT structure below (used by the engine).

---

## ✅ UNIVERSAL SCHEMA FORMAT (STRICT TEMPLATE)

{
  "questionName": "string (short and clear problem title)",
  "patternType": "array | linkedList | binaryTree | graph | matrix | stack | queue",
  "sampleInput": {},
  "sampleOutput": {},

  "visualLayout": {
    "structures": [
      {
        "id": "unique_id",
        "type": "array | linkedlist | binaryTree | graph | matrix | stack | queue | variable | result",
        "label": "User-friendly display label",
        "data": [],
        "rows": 0,
        "cols": 0,
        "value": null,
        "nodes": [],
        "edges": [],
        "cycleStart": null,
        "cycleEnd": null
      }
    ]
  },

  "steps": [
    {
      "step": 1,
      "action": "visit | compare | update | pointerMove | push | pop | enqueue | dequeue | connect | disconnect | mark | swap | create | delete",
      "elements": [
        { "structure": "structure_id", "index": 0, "value": 5 }
      ],
      "highlight": [
        { "structure": "structure_id", "index": 0 }
      ],
      "message": "Short explanation of this step",
      "condition": {
        "expression": "optional logical condition",
        "result": true
      },
      "stateChange": {
        "structure_or_variable_id": "new_value or updated array/object"
      }
    }
  ],

  "endMessage": "Final status message shown after all steps.",

  "actionReference": {
    "visit": "Highlight element or node — used in traversals",
    "compare": "Compare two elements — used in sorting or searching",
    "swap": "Exchange two elements — used in sorting or reversing",
    "mark": "Mark element as done/visited/sorted",
    "push": "Push value to stack — stack-based operations",
    "pop": "Pop value from stack",
    "enqueue": "Add to queue — BFS operations",
    "dequeue": "Remove from queue",
    "pointerMove": "Move pointer (like i++, j++) — used in 2-pointers or linked lists",
    "update": "Update a value in array, grid, or variable",
    "connect": "Add edge between nodes — used in graphs",
    "disconnect": "Remove edge — used in graphs",
    "stateChange": "Generic variable/stat update (e.g., comparisons++)",
    "create": "Create new node/structure",
    "delete": "Delete node/structure"
  }
}

---

## ⚙️ RULES — FOLLOW THESE STRICTLY

### 1️⃣ General Rules
- JSON must **start with `{` and end with `}`**, no markdown or commentary.
- Use **double quotes** for all keys and values.
- No text outside JSON.
- `patternType` determines which structures to include.
- Always include at least one `variable` structure for counters/pointers.
- Use `stateChange` to update data, arrays, variables, etc.
- Include **8–15 steps** minimum with clear visual progress.
- Keep `"message"` human-readable (1–2 lines max).

---

## 🔢 PATTERN-SPECIFIC STRUCTURE BLUEPRINTS

### 🧩 ARRAY / 2-POINTER / SORTING / MERGING
- patternType: "array"
- structures:
  - 1–2 arrays (e.g., arr1, arr2, result)
  - variables (like i, j, k)
- actions: compare, update, swap, pointerMove, mark

### 🔗 LINKED LIST
- patternType: "linkedlist"
- structures:
  - linkedlist (list, head, etc.)
  - variable pointers (slow, fast, current)
  - optional result variable
- actions: pointerMove, visit, compare, connect, mark
- `cycleStart` and `cycleEnd` fields can exist for cycle problems

### 🌳 BINARY TREE
- patternType: "binaryTree"
- Structures:
  - binaryTree must have `data` as a **flat array** of primitive node values (numbers or strings only)
    ✅ Example: [1, 2, 2, 3, 4, 4, 3]
    ❌ Never use objects like {nodeIdx: 1, time: 3} or {value: 2, left: 1, right: 3}.
  - stack or queue can be used for traversal visualization.
  - Optional variable fields: isMirror, pair, currentNode.
- Each step action (visit, compare, mark, push, pop) should highlight node indices in `data`.
- stateChange must only include arrays or scalar values, not nested objects.


### 🌐 GRAPH
- patternType: "graph"
- structures:
  - graph with nodes & edges or adjacency list in `data`
  - visited array
  - recursionStack or queue
  - result variable
- actions: visit, update, compare, mark, connect
- highlight uses `"nodes"` or `"edges"` instead of `"index"` where necessary

### 🧮 MATRIX / DP
- patternType: "matrix"
- structures:
  - matrix (grid or dp)
  - i, j, rows, cols as variable types
  - result variable
- actions: visit, update, compare, mark
- highlight: { "structure": "dp", "index": linear_index } OR row/col-based
- dp updates reflected in `stateChange`

### 🧱 STACK
- patternType: "stack"
- structures:
  - stack (data array)
  - input array (if applicable)
  - current variable
  - result boolean variable
- actions: visit, compare, push, pop, mark

### 🧊 QUEUE
- patternType: "queue"
- structures:
  - queue
  - array or input stream
  - current index variable
- actions: enqueue, dequeue, compare, mark

---

## ⚡ VISUALIZATION BEHAVIOR CONTROL
Each `step` drives animation in engine:
- `highlight` → glow or bounce elements
- `stateChange` → animates values or structure change
- `message` → displayed below animation area
- `endMessage` → final output banner

---

## 🚫 NEVER USE
- "structureId", "indices", "structure_id"
- "variable" array inside another structure
- "stateChange" nested beyond one level
- Markdown text, triple backticks, or explanations outside JSON

---

## 🎯 OUTPUT QUALITY EXPECTATION
Your output must:
- Be syntactically valid JSON
- Match the key names and hierarchy exactly
- Contain at least 10 logical visualization steps
- Have human-readable messages aligned with algorithm progress
- Be consistent for any supported DSA pattern

---

Now generate a **single complete JSON** matching this schema
for the given problem below.
"""

    user_section = f"""
INPUT TYPE: {input_type}

PROBLEM OR CODE SNIPPET:
{prompt}

Generate the final visualization JSON following the exact schema and key names required by the engine.
Ensure correct structure fields, patternType inference, and consistent step actions.
Return ONLY the JSON — no markdown, no explanation.
"""

    return system_prompt + user_section




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
# """
# DSA Visualizer JSON Generator Route (Updated)
# ==============================================
# Production-ready FastAPI endpoint that converts DSA problems/code 
# into universal JSON schema for the visualization engine.

# Supported Data Structures:
# - array (1D arrays, DP problems, HashMap emulation)
# - linkedList (singly, doubly, circular)
# - binaryTree (traversals, construction, queries)
# - graph (BFS, DFS, shortest path, topological sort)
# - matrix (2D arrays, grid problems, DP 2D)
# - stack (DFS, expression evaluation, backtracking prep)
# - queue (BFS, level order, scheduling)

# Features:
# - Handles natural language questions
# - Processes code snippets
# - Validates JSON output
# - Error recovery and fallback
# - Type checking and schema validation
# - Proper HTTP responses
# """

# from fastapi import APIRouter, HTTPException, status
# from pydantic import BaseModel, Field, validator
# import json
# import logging
# from typing import Optional, Dict, Any
# import re

# # Configure logging
# logger = logging.getLogger(__name__)

# # ============================================================
# # Constants
# # ============================================================

# SUPPORTED_PATTERNS = [
#     "array",        # 1D arrays, DP problems, HashMap simulation
#     "linkedList",   # Singly, doubly, circular linked lists
#     "binaryTree",   # Tree traversals, construction, queries
#     "graph",        # BFS, DFS, shortest path, topological sort, SCC
#     "matrix",       # 2D arrays, grid problems, 2D DP
#     "stack",        # DFS, expression evaluation, monotonic stack
#     "queue"         # BFS, level order, scheduling, sliding window
# ]

# SUPPORTED_STRUCTURE_TYPES = [
#     "array",
#     "linkedlist",
#     "stack",
#     "queue",
#     "binarytree",
#     "graph",
#     "matrix",
#     "variable",
#     "result"
# ]

# SUPPORTED_ACTIONS = [
#     "visit",         # Highlight element - traversals
#     "compare",       # Compare elements - sorting/searching
#     "swap",          # Exchange elements - sorting
#     "mark",          # Mark as visited/sorted/processed
#     "push",          # Push to stack
#     "pop",           # Pop from stack
#     "enqueue",       # Add to queue
#     "dequeue",       # Remove from queue
#     "pointerMove",   # Move pointer (i++, j--)
#     "update",        # Update value
#     "connect",       # Add edge (graphs)
#     "disconnect",    # Remove edge (graphs)
#     "create",        # Create new node
#     "delete"         # Delete node
# ]

# # ============================================================
# # Pydantic Models
# # ============================================================

# class InputModel(BaseModel):
#     """Input model for DSA problem/code"""
#     prompt: str = Field(
#         ...,
#         min_length=10,
#         max_length=5000,
#         description="DSA problem statement or code snippet"
#     )
    
#     @validator('prompt')
#     def validate_prompt(cls, v):
#         """Validate and clean input"""
#         v = v.strip()
#         if len(v) < 10:
#             raise ValueError("Prompt must be at least 10 characters")
#         if len(v) > 5000:
#             raise ValueError("Prompt must not exceed 5000 characters")
#         return v


# class StructureModel(BaseModel):
#     """Visualization structure model"""
#     id: str
#     type: str
#     label: str
#     data: Optional[list] = None
#     rows: Optional[int] = None
#     cols: Optional[int] = None
#     value: Optional[Any] = None
#     nodes: Optional[list] = None
#     edges: Optional[list] = None
#     directed: Optional[bool] = None
#     weighted: Optional[bool] = None


# class ConditionModel(BaseModel):
#     """Step condition model"""
#     expression: str
#     result: bool


# class StepModel(BaseModel):
#     """Single visualization step"""
#     step: int
#     action: str
#     elements: Optional[list] = None
#     highlight: Optional[list] = None
#     message: str
#     condition: Optional[ConditionModel] = None
#     stateChange: Optional[Dict[str, Any]] = None


# class VisualizationJSONModel(BaseModel):
#     """Complete visualization JSON output"""
#     questionName: str
#     patternType: str
#     sampleInput: Dict[str, Any]
#     sampleOutput: Dict[str, Any]
#     visualLayout: Dict[str, Any]
#     steps: list[StepModel]
#     endMessage: str
#     actionReference: Optional[Dict[str, str]] = None


# class ResponseModel(BaseModel):
#     """API response model"""
#     success: bool
#     data: Optional[VisualizationJSONModel] = None
#     error: Optional[str] = None
#     message: Optional[str] = None


# # ============================================================
# # Initialize Router and Gemini Client
# # ============================================================

# router = APIRouter(prefix="/api", tags=["dsa-visualizer"])

# try:
#     # import google.generativeai as genai
#     from google import genai
#     import os
#     api_key = os.getenv("GEMINI_API_KEY")
#     if api_key:
#         genai.configure(api_key=api_key)
#     client = genai
# except ImportError:
#     logger.warning("Google AI not available")
#     client = None


# # ============================================================
# # Helper Functions
# # ============================================================

# def detect_input_type(prompt: str) -> str:
#     """
#     Detect if input is code or natural language question
    
#     Returns:
#         "code" or "question"
#     """
#     code_keywords = [
#         "def ", "class ", "public ", "private ", "static ",
#         "#include", "int main", "function", "=>", "const ",
#         "let ", "var ", "return ", "for (", "while (",
#         "if (", "else", "switch", "{", "};", "import ",
#         "from ", "async ", "await"
#     ]
    
#     for keyword in code_keywords:
#         if keyword in prompt:
#             return "code"
    
#     return "question"


# def clean_json_response(text: str) -> str:
#     """
#     Clean Gemini response to extract valid JSON
    
#     Handles:
#     - Markdown code fences
#     - Extra commentary
#     - JSON wrapped in backticks
#     """
#     text = text.strip()
    
#     # Remove markdown code fences
#     if text.startswith("```"):
#         match = re.search(r'```(?:json)?\n?(.*?)\n?```', text, re.DOTALL)
#         if match:
#             text = match.group(1).strip()
#         else:
#             text = text.split("```")[1] if "```" in text else text
    
#     # Remove "json" prefix if present
#     if text.startswith("json"):
#         text = text[4:].strip()
    
#     # Find the last closing brace and cut there
#     last_brace = text.rfind('}')
#     if last_brace > 0:
#         text = text[:last_brace + 1]
    
#     return text.strip()


# def validate_json_schema(data: Dict[str, Any]) -> tuple[bool, str]:
#     """
#     Validate JSON against universal schema
    
#     Returns:
#         (is_valid, error_message)
#     """
#     required_fields = [
#         "questionName",
#         "patternType",
#         "sampleInput",
#         "sampleOutput",
#         "visualLayout",
#         "steps",
#         "endMessage"
#     ]
    
#     # Check required fields
#     for field in required_fields:
#         if field not in data:
#             return False, f"Missing required field: {field}"
    
#     # Validate pattern type
#     if data.get("patternType") not in SUPPORTED_PATTERNS:
#         return False, f"Invalid patternType. Supported: {', '.join(SUPPORTED_PATTERNS)}"
    
#     # Check visualLayout structure
#     if "structures" not in data.get("visualLayout", {}):
#         return False, "visualLayout.structures missing"
    
#     structures = data["visualLayout"]["structures"]
#     if not isinstance(structures, list):
#         return False, "visualLayout.structures must be an array"
    
#     if len(structures) == 0:
#         return False, "visualLayout.structures cannot be empty"
    
#     # Validate structure types
#     for struct in structures:
#         if struct.get("type") not in SUPPORTED_STRUCTURE_TYPES:
#             return False, f"Invalid structure type: {struct.get('type')}. Supported: {', '.join(SUPPORTED_STRUCTURE_TYPES)}"
    
#     # Check steps
#     steps = data.get("steps")
#     if not isinstance(steps, list):
#         return False, "steps must be an array"
    
#     if len(steps) == 0:
#         return False, "steps cannot be empty"
    
#     # Validate step actions
#     for step in steps:
#         action = step.get("action")
#         if action not in SUPPORTED_ACTIONS:
#             return False, f"Invalid action: {action}. Supported: {', '.join(SUPPORTED_ACTIONS)}"
    
#     return True, ""


# def enrich_json_with_defaults(data: Dict[str, Any]) -> Dict[str, Any]:
#     """
#     Add default actionReference if missing
#     """
#     if "actionReference" not in data:
#         data["actionReference"] = {
#             "visit": "Highlight element or node — used in traversals",
#             "compare": "Compare two elements — used in sorting or searching",
#             "swap": "Exchange two elements — used in sorting or reversing",
#             "mark": "Mark element as done/visited/sorted/processed",
#             "push": "Push value to stack — stack-based operations",
#             "pop": "Pop value from stack — stack-based operations",
#             "enqueue": "Add to queue — BFS and level order operations",
#             "dequeue": "Remove from queue — BFS and level order operations",
#             "pointerMove": "Move pointer (like i++, j--) — used in 2-pointers or linked lists",
#             "update": "Update a value in array, grid, or variable",
#             "connect": "Add edge between nodes — used in graphs",
#             "disconnect": "Remove edge — used in graphs",
#             "create": "Create new node/structure",
#             "delete": "Delete node/structure"
#         }
    
#     return data


# # ============================================================
# # System Prompts
# # ============================================================

# SYSTEM_PROMPT = f"""You are a **highly specialized DSA-to-Visualization JSON generator**.
# Your task is to read either:
# 1️⃣ A **DSA question/problem statement**, OR
# 2️⃣ A **code snippet implementing a DSA algorithm**

# and output a **strictly valid JSON** that can be rendered by a visualization engine.

# ### 🎯 Supported Data Structures (Use ONLY these):
# - **array**: 1D arrays, sorting, searching, DP 1D, HashMap simulation
# - **linkedList**: Singly, doubly, circular linked lists
# - **binaryTree**: Traversals, construction, queries, BST operations
# - **graph**: BFS, DFS, shortest path, topological sort, SCC, MST
# - **matrix**: 2D grids, matrix operations, DP 2D
# - **stack**: DFS, expression evaluation, monotonic stack
# - **queue**: BFS, level order traversal, scheduling, sliding window

# ### 🔍 Determine Mode
# If the input looks like code:
# - Extract its algorithmic logic
# - Correct any syntax errors if needed
# - Infer sampleInput and sampleOutput based on code logic

# If the input is a natural question:
# - Identify the core pattern from above list
# - Generate clear sampleInput and sampleOutput
# - Build step-by-step logical visualization

# ### 🧩 Output Format (Universal Schema)

# {{
#   "questionName": "Clear problem name",
#   "patternType": "array | linkedList | binaryTree | graph | matrix | stack | queue",
#   "sampleInput": {{}},
#   "sampleOutput": {{}},

#   "visualLayout": {{
#     "structures": [
#       {{
#         "id": "unique_id",
#         "type": "array | linkedlist | stack | queue | binarytree | graph | matrix | variable | result",
#         "label": "Display label",
#         "data": [],
#         "rows": 0,
#         "cols": 0,
#         "value": null,
#         "nodes": [],
#         "edges": [],
#         "directed": false,
#         "weighted": false
#       }}
#     ]
#   }},

#   "steps": [
#     {{
#       "step": 1,
#       "action": "visit | compare | swap | push | pop | enqueue | dequeue | mark | pointerMove | update | connect | create | delete",
#       "highlight": ["id:index or id:nodeName"],
#       "message": "Clear one-line explanation",
#       "condition": {{"expression": "i < j", "result": true}},
#       "stateChange": {{}}
#     }}
#   ],

#   "endMessage": "Final result summary"
# }}

# ### 📋 DP Problem Handling
# - **1D DP**: Use "array" type with variables for dp array, index, etc.
# - **2D DP**: Use "matrix" type for DP table with "rows" and "cols"
# - Show state transitions with stateChange in each step
# - Use variables to track loop counters and comparisons

# ### 📊 Pattern Examples

# **Array (Sorting/Searching/1D DP):**
# ```json
# "structures": [
#   {{"id": "arr", "type": "array", "label": "Array", "data": [3,1,4,1,5]}},
#   {{"id": "i", "type": "variable", "label": "Index", "value": 0}},
#   {{"id": "minIdx", "type": "variable", "label": "Min Index", "value": 0}}
# ]
# ```

# **LinkedList:**
# ```json
# "structures": [
#   {{"id": "list", "type": "linkedlist", "label": "Linked List", "data": [1,2,3,4,5]}},
#   {{"id": "ptr", "type": "variable", "label": "Pointer", "value": 0}}
# ]
# ```

# **BinaryTree:**
# ```json
# "structures": [
#   {{"id": "tree", "type": "binarytree", "label": "Tree", "data": [1,2,3,4,5,null,6]}},
#   {{"id": "queue", "type": "queue", "label": "BFS Queue", "data": []}}
# ]
# ```

# **Graph:**
# ```json
# "structures": [
#   {{
#     "id": "g", "type": "graph", "label": "Graph",
#     "nodes": ["A","B","C","D"],
#     "edges": [{{"from":"A","to":"B"}}, {{"from":"B","to":"C"}}],
#     "directed": true
#   }}
# ]
# ```

# **Matrix (2D DP):**
# ```json
# "structures": [
#   {{"id": "dp", "type": "matrix", "label": "DP Table", "data": [[0,0,0], [0,0,0]], "rows": 2, "cols": 3}},
#   {{"id": "i", "type": "variable", "label": "Row", "value": 0}}
# ]
# ```

# ### 🧠 Rules
# - Output **ONLY** valid JSON - no markdown, no commentary
# - Use only supported structures
# - Use only supported actions
# - Binary trees: "data": [root, left, right, ...]
# - Graphs: include "nodes" and "edges"
# - Matrix: include "rows" and "cols"
# - Each step = one logical animation move
# - Provide 8-15 steps for clear understanding
# """


# def build_user_prompt(question: str, input_type: str) -> str:
#     """Build the full user prompt with system context"""
#     return f"""{SYSTEM_PROMPT}

# ### 🚀 User Input ({input_type.upper()}):
# {question}

# Generate the **final JSON visualization now** — output ONLY valid JSON, no extra text."""


# # ============================================================
# # Main Endpoint
# # ============================================================

# @router.post(
#     "/generate-visualization",
#     response_model=ResponseModel,
#     status_code=status.HTTP_200_OK,
#     summary="Generate DSA Visualization JSON",
#     description="Converts a DSA problem statement or code snippet into universal JSON format"
# )
# async def generate_visualization(input_data: InputModel):
#     """
#     Generate visualization JSON from DSA problem or code
    
#     **Supported Patterns:**
#     - array (1D, sorting, searching, DP 1D, HashMap)
#     - linkedList (singly, doubly, circular)
#     - binaryTree (traversals, construction)
#     - graph (BFS, DFS, shortest path)
#     - matrix (2D grids, DP 2D)
#     - stack (DFS, expression evaluation)
#     - queue (BFS, level order)
    
#     **Input Examples:**
#     - Problem: "Find the maximum element in an array"
#     - Code: Function implementing a DSA algorithm
    
#     **Output:**
#     - Complete visualization JSON following universal schema
#     """
#     try:
#         # Detect input type
#         input_type = detect_input_type(input_data.prompt)
#         logger.info(f"Detected input type: {input_type}")
        
#         # Check if Gemini client is available
#         if not client:
#             logger.error("Gemini client not configured")
#             raise HTTPException(
#                 status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
#                 detail="AI service unavailable. Please check API configuration."
#             )
        
#         # Build prompt
#         full_prompt = build_user_prompt(input_data.prompt, input_type)
        
#         # Call Gemini API
#         logger.info("Calling Gemini API...")
#         response = client.models.generate_content(
#             model="gemini-2.5-flash",
#             contents=full_prompt
#         )
        
#         if not response or not response.text:
#             logger.error("Empty response from Gemini")
#             raise HTTPException(
#                 status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                 detail="Failed to generate visualization. Empty API response."
#             )
        
#         # Clean and parse response
#         cleaned_text = clean_json_response(response.text)
#         logger.info(f"Cleaned response length: {len(cleaned_text)}")
        
#         try:
#             result = json.loads(cleaned_text)
#         except json.JSONDecodeError as e:
#             logger.error(f"JSON parse error: {str(e)}")
#             raise HTTPException(
#                 status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
#                 detail=f"Invalid JSON generated: {str(e)}"
#             )
        
#         # Validate schema
#         is_valid, error_msg = validate_json_schema(result)
#         if not is_valid:
#             logger.error(f"Schema validation failed: {error_msg}")
#             raise HTTPException(
#                 status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
#                 detail=f"Schema validation failed: {error_msg}"
#             )
        
#         # Enrich with defaults
#         result = enrich_json_with_defaults(result)
        
#         # Validate with Pydantic
#         try:
#             validated = VisualizationJSONModel(**result)
#         except Exception as e:
#             logger.error(f"Pydantic validation error: {str(e)}")
#             raise HTTPException(
#                 status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
#                 detail=f"Validation error: {str(e)}"
#             )
        
#         logger.info("Visualization JSON generated successfully")
        
#         return ResponseModel(
#             success=True,
#             data=validated,
#             message=f"Successfully generated visualization for {input_type} input"
#         )
    
#     except HTTPException:
#         raise
    
#     except Exception as e:
#         logger.exception(f"Unexpected error: {str(e)}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Internal server error: {str(e)}"
#         )


# @router.get(
#     "/supported-patterns",
#     summary="Get Supported Patterns",
#     description="List all supported data structure patterns"
# )
# async def get_supported_patterns():
#     """Get list of supported patterns and structure types"""
#     return {
#         "success": True,
#         "patterns": SUPPORTED_PATTERNS,
#         "structure_types": SUPPORTED_STRUCTURE_TYPES,
#         "actions": SUPPORTED_ACTIONS,
#         "description": {
#             "array": "1D arrays, sorting, searching, DP problems, HashMap simulation",
#             "linkedList": "Singly, doubly, circular linked lists",
#             "binaryTree": "Tree traversals, construction, queries, BST operations",
#             "graph": "BFS, DFS, shortest path, topological sort, SCC, MST",
#             "matrix": "2D grids, matrix operations, 2D DP problems",
#             "stack": "DFS, expression evaluation, monotonic stack operations",
#             "queue": "BFS, level order traversal, scheduling, sliding window"
#         }
#     }


# @router.post(
#     "/validate-json",
#     status_code=status.HTTP_200_OK,
#     summary="Validate Visualization JSON",
#     description="Validate if JSON follows the universal schema"
# )
# async def validate_json(json_data: Dict[str, Any]):
#     """
#     Validate JSON against universal schema
    
#     **Input:** JSON object to validate
#     **Output:** Validation result with errors if any
#     """
#     try:
#         is_valid, error_msg = validate_json_schema(json_data)
        
#         if not is_valid:
#             raise HTTPException(
#                 status_code=status.HTTP_400_BAD_REQUEST,
#                 detail=f"JSON validation failed: {error_msg}"
#             )
        
#         return ResponseModel(
#             success=True,
#             message="JSON is valid"
#         )
    
#     except HTTPException:
#         raise
    
#     except Exception as e:
#         logger.exception(f"Validation error: {str(e)}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Validation error: {str(e)}"
#         )


# @router.get(
#     "/schema",
#     summary="Get Universal Schema",
#     description="Return the universal JSON schema for reference"
# )
# async def get_schema():
#     """
#     Get the universal schema template
    
#     **Returns:** Complete schema structure with descriptions
#     """
#     schema = {
#         "questionName": "Problem title",
#         "patternType": "array | linkedList | binaryTree | graph | matrix | stack | queue",
#         "sampleInput": {"example": "value"},
#         "sampleOutput": {"example": "result"},
#         "visualLayout": {
#             "structures": [
#                 {
#                     "id": "unique_id",
#                     "type": "array | linkedlist | stack | queue | binarytree | graph | matrix | variable | result",
#                     "label": "Display Name",
#                     "data": [],
#                     "rows": 0,
#                     "cols": 0,
#                     "value": None,
#                     "nodes": [],
#                     "edges": [],
#                     "directed": False,
#                     "weighted": False
#                 }
#             ]
#         },
#         "steps": [
#             {
#                 "step": 1,
#                 "action": "visit | compare | swap | push | pop | enqueue | dequeue | mark | pointerMove | update | connect | create | delete",
#                 "highlight": ["id:index"],
#                 "message": "Explanation",
#                 "condition": {
#                     "expression": "condition",
#                     "result": True
#                 },
#                 "stateChange": {}
#             }
#         ],
#         "endMessage": "Completion message"
#     }
    
#     return ResponseModel(
#         success=True,
#         data=schema,
#         message="Schema template returned"
#     )


# @router.get(
#     "/health",
#     summary="Health Check",
#     description="Check if the service is running"
# )
# async def health_check():
#     """Service health status"""
#     return {
#         "status": "healthy",
#         "service": "DSA Visualizer Generator",
#         "gemini_configured": client is not None,
#         "supported_patterns": len(SUPPORTED_PATTERNS)
#     }