# Logic to evaluate the RAG pipeline.
import json
import os
from dotenv import load_dotenv

from ragas import evaluate
from ragas.llms import llm_factory
from ragas.dataset_schema import EvaluationDataset, SingleTurnSample
from ragas.metrics._context_recall import ContextRecall
from ragas.metrics._faithfulness import Faithfulness
from ragas.metrics._factual_correctness import FactualCorrectness
from ragas.metrics._answer_relevance import AnswerRelevancy

from openai import OpenAI
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from llama_index.core import VectorStoreIndex, StorageContext, Settings
from llama_index.vector_stores.supabase import SupabaseVectorStore
from ragas.embeddings.base import LangchainEmbeddingsWrapper
from embeddings import embed_model
from llm import llm

load_dotenv()

# --- Load testset ---
testset_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "testset_light.json")
with open(testset_path) as f:
    testset_data = json.load(f)

print(f"Loaded {len(testset_data)} test samples from testset.json")

# --- Connect to existing RAG vector store ---
Settings.llm = llm
vector_store = SupabaseVectorStore(
    postgres_connection_string=os.getenv("DATABASE_URL"),
    collection_name="embeddings",
    dimension=768,
)
index = VectorStoreIndex.from_vector_store(vector_store, embed_model=embed_model)
query_engine = index.as_query_engine(llm=llm)

# --- Run each question through RAG, collect response + retrieved contexts ---
samples = []
for item in testset_data:
    question = item["user_input"]
    print(f"Querying: {question[:80]}...")

    response = query_engine.query(question)

    response_text = str(response)
    retrieved_contexts = [node.text for node in response.source_nodes]

    samples.append(SingleTurnSample(
        user_input=question,
        response=response_text,
        retrieved_contexts=retrieved_contexts,
        reference=item.get("reference", ""),
        reference_contexts=item.get("reference_contexts", []),
        persona_name=item.get("persona_name", ""),
        query_style=item.get("query_style", ""),
        query_length=item.get("query_length", ""),
    ))

evaluation_dataset = EvaluationDataset(samples=samples)
print(f"\nBuilt evaluation dataset with {len(evaluation_dataset)} samples")

# --- Evaluate ---
groq_client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)
evaluator_llm = llm_factory("llama-3.3-70b-versatile", provider="openai", client=groq_client)

ragas_embeddings = LangchainEmbeddingsWrapper(
    GoogleGenerativeAIEmbeddings(
        model="gemini-embedding-2-preview",
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )
)

result = evaluate(
    dataset=evaluation_dataset,
    metrics=[
        ContextRecall(llm=evaluator_llm),
        Faithfulness(llm=evaluator_llm),
        FactualCorrectness(llm=evaluator_llm),
        AnswerRelevancy(llm=evaluator_llm, embeddings=ragas_embeddings),
    ],
)

print(result)
