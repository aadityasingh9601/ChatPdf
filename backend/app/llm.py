from llama_index.llms.google_genai import GoogleGenAI
from dotenv import load_dotenv, dotenv_values
from openai import OpenAI
from ragas.llms import llm_factory
import os
load_dotenv()

# You can use other gemini flash models too like gemini-3.5-flash-lite, gemini-3.1-flash-lite, gemini-2.5-flash-lite 

key: str = os.getenv("GEMINI_API_KEY")

llm = GoogleGenAI(
    model="gemini-3.5-flash-lite",
    api_key=key,
)

groq_client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

llm2 = llm_factory("llama-3.3-70b-versatile", provider="openai", client=groq_client) 

