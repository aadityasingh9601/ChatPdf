from llama_index.embeddings.google_genai import GoogleGenAIEmbedding
from google.genai.types import EmbedContentConfig
from dotenv import load_dotenv
import os
from typing import List, Optional
from app.utils import helper
load_dotenv()

key: str = os.getenv("GEMINI_API_KEY")

TARGET_DIM = 768


class TruncatedGoogleGenAIEmbedding(GoogleGenAIEmbedding):
    """GoogleGenAIEmbedding subclass that truncates embeddings to TARGET_DIM."""

    def _embed_texts(
        self, texts: List[str], task_type: Optional[str] = None
    ) -> List[List[float]]:
        embeddings = super()._embed_texts(texts, task_type)
        return [helper.truncate_embedding(e, TARGET_DIM) for e in embeddings]

    async def _aembed_texts(
        self, texts: List[str], task_type: Optional[str] = None
    ) -> List[List[float]]:
        embeddings = await super()._aembed_texts(texts, task_type)
        return [helper.truncate_embedding(e, TARGET_DIM) for e in embeddings]


embed_model = TruncatedGoogleGenAIEmbedding(
    model_name="gemini-embedding-2-preview",
    embed_batch_size=50,
    api_key=key,
)

