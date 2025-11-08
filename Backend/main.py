"""
Main FastAPI entry point
========================
This initializes the FastAPI application and includes
the DSA Visualizer Gemini route from gemini.py
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# from gemini import router as gemini_router
from routes.gemini import router as gemini_router

app = FastAPI(
    title="DSA Visualizer JSON API",
    description="Converts DSA questions or code into universal visualization JSON.",
    version="1.0.0",
    contact={
        "name": "Atharva DSA Visualizer",
        "url": "https://github.com/your-repo",
        "email": "your.email@example.com",
    },
)

# ✅ Enable CORS for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Include the Gemini route
app.include_router(gemini_router)

# ✅ Root Route
@app.get("/", tags=["root"])
async def root():
    return {
        "message": "Welcome to the DSA Visualizer API 🚀",
        "docs": "/docs",
        "health": "/api/health"
    }

# ✅ Run the app (for local testing)
# uvicorn main:app --reload

# from fastapi import FastAPI
# from pydantic import BaseModel
# from google import genai
# import json
# import os
# from fastapi.middleware.cors import CORSMiddleware
# from dotenv import load_dotenv

# # ======== LOAD ENVIRONMENT VARIABLES ========
# load_dotenv()  # 👈 loads .env file automatically

# GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# if not GEMINI_API_KEY:
#     raise ValueError("❌ GEMINI_API_KEY not found. Please add it to your .env file.")

# # ======== INITIALIZE GEMINI CLIENT ========
# client = genai.Client(api_key=GEMINI_API_KEY)

# # ======== FASTAPI APP ========
# app = FastAPI(title="DSA Visualizer JSON Generator")

# # ✅ Allow frontend origins
# origins = [
#     "http://localhost:5173",
#     "http://127.0.0.1:5173",
# ]

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=origins,
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # ======== REQUEST MODEL ========
# class InputModel(BaseModel):
#     prompt: str

# # ======== POST ENDPOINT ========
# @app.post("/generate-json")
# async def generate_json(input_data: InputModel):
#     """
#     Takes a plain English or code description of a DSA problem,
#     and returns a structured JSON for animation engine.
#     """

#     user_prompt = input_data.prompt.strip()

#     # ======== CORE PROMPT ENGINEERING ========
#     full_prompt = f"""
# You are a highly specialized assistant that converts any Data Structures & Algorithms (DSA) problem
# description into a structured JSON format for a visualization engine.

# ### Your Responsibilities:
# - Understand the question or logic described in the input.
# - Identify the core pattern type (e.g., array, linkedList, binaryTree, graph).
# - Create a complete visualization-ready JSON.
# - Include detailed step-by-step actions for every operation.
# - Do **NOT** include extra commentary, text, or Markdown code fences.
# - Output only **valid JSON** that strictly follows this format:

# {{
#   "questionName": "string",
#   "patternType": "array | linkedList | tree | graph | hashmap",
#   "sampleInput": [],
#   "sampleOutput": [],
#   "visualLayout": {{
#     "structures": [
#       {{
#         "id": "string",
#         "type": "array | variable | node",
#         "label": "string",
#         "data": []
#       }}
#     ]
#   }},
#   "steps": [
#     {{
#       "step": number,
#       "action": "compare | swap | update | mark | pointerMove",
#       "elements": [{{"structure": "id", "index": number, "value": number}}],
#       "highlight": [{{"structure": "id", "index": number}}],
#       "message": "Explain current operation",
#       "condition": {{
#         "expression": "optional condition",
#         "result": true | false
#       }}
#     }}
#   ],
#   "endMessage": "Final completion message"
# }}

# ### Rules:
# - Use clear variable names like arr, left, right, i, j, etc.
# - If the problem involves iteration, use `compare`, `swap`, or `update` actions.
# - For conditions like `i < j`, include `"condition": {{"expression": "i < j", "result": true}}`
# - Always have at least 1 `array` and `variable` structure if relevant.
# - Steps must describe the logical flow clearly for visualization.
# - If unsure about pattern type, default to `"array"`.

# ### Now, generate the JSON for:
# "{user_prompt}"
# """

#     # ======== GEMINI CALL ========
#     response = client.models.generate_content(
#         model="gemini-2.5-flash",
#         contents=full_prompt
#     )

#     # ======== RESPONSE CLEANING ========
#     text = response.text.strip()

#     # Remove markdown-style fences if any
#     if text.startswith("```"):
#         text = text.split("```")[1]
#         if text.startswith("json"):
#             text = text[len("json"):]
#         text = text.strip()

#     # Try to parse JSON safely
#     try:
#         result = json.loads(text)
#     except json.JSONDecodeError:
#         result = {"error": "Invalid JSON output", "raw": text}

#     return result
