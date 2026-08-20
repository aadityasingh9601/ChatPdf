from llama_index.llms.google_genai import GoogleGenAI
from llama_index.llms.openai_like import OpenAILike
from dotenv import load_dotenv, dotenv_values
from openai import OpenAI
import os
load_dotenv()

key: str = os.getenv("GEMINI_API_KEY")

llm = GoogleGenAI(
    model="gemini-3.5-flash-lite",
    api_key=key,
)

groq_client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

# OpenAILike targets OpenAI-compatible endpoints (like Groq) without validating
# the model name against OpenAI's model list, so it can be passed straight to
# as_query_engine() just like llm (Gemini).
llm2 = OpenAILike(
    model="openai/gpt-oss-120b",
    api_key=os.getenv("GROQ_API_KEY"),
    api_base="https://api.groq.com/openai/v1",
    is_chat_model=True,
    context_window=131072,
)

# You can also add other free LLM models like qwen/qwen3.6-27b.