from colorama import Fore, Back, Style
from llama_index.core import VectorStoreIndex, StorageContext
from llama_index.vector_stores.supabase import SupabaseVectorStore
from llama_index.core.vector_stores import MetadataFilter, MetadataFilters
from app.embeddings import embed_model
from app.llm import llm, llm2
import os
import textwrap
from dotenv import load_dotenv
load_dotenv()

def answerUserQuery(userId:str, pdfName:str, userQuery: str, prefer: str = "llm2"):
    vector_store = SupabaseVectorStore(
    postgres_connection_string=os.getenv("DATABASE_URL"),
    collection_name="embeddings",
    dimension=768
  )

    index = VectorStoreIndex.from_vector_store(vector_store, embed_model=embed_model)
    filters = MetadataFilters(filters=[
    MetadataFilter(key="user_id", value=userId),
    MetadataFilter(key="file_name", value=pdfName)
])

    llms = {"llm": llm, "llm2": llm2}
    primary = llms.get(prefer, llm2)
    fallback = llm if primary is llm2 else llm2

    def run(engine_llm):
        query_engine = index.as_query_engine(llm=engine_llm, filters=filters)
        return query_engine.query(userQuery)

    # Use the preferred LLM first (llm2 = Groq by default). If it fails —
    # e.g. the Groq free-tier quota is exhausted / rate limited — fall back
    # to the other LLM (llm = Gemini) automatically.
    try:
        response = run(primary)
    except Exception:
        print(Fore.YELLOW + "Primary LLM failed (possibly exhausted/rate-limited), falling back to the other LLM.")
        response = run(fallback)

    print(Fore.GREEN + str(response))
    return response


if __name__ == "__main__":
    answerUserQuery()
