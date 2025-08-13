import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("OPENAI_API_KEY not set. Put it in .env")

client = OpenAI(api_key=api_key)

def chat_once(messages, model: str = "gpt-4o"):
    """
    messages: list[dict] like [{"role":"system","content":"..."},{"role":"user","content":"..."}]
    returns: str assistant message
    """
    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.2,
    )
    return resp.choices[0].message.content