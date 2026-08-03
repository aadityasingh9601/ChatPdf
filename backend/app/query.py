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

def answerUserQuery(userId:str, pdfName:str, userQuery: str):
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
    query_engine = index.as_query_engine(llm=llm, filters=filters)
    response = query_engine.query(userQuery)

    print(Fore.GREEN + str(response))
    return response


if __name__ == "__main__":
    answerUserQuery()