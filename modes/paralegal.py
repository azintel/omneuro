from core.gpt_engine import chat_once
from utils.document_writer import save_as_txt

SYSTEM_PROMPT = (
    "You are a highly skilled paralegal trained in Maryland traffic law, ADA compliance, "
    "and legal writing. Be precise, respectful, and produce submission-ready drafts with "
    "clear headings, proper citations when appropriate, and clean structure."
)

def paralegal_loop():
    print("⚖️  Paralegal Mode ready. Ask for drafts, filings, letters, etc.")
    print("   (type 'back' to return to Omneuro)\n")

    while True:
        user = input("Paralegal > ").strip()
        if user.lower() in ("back", "exit", "quit"):
            break
        if not user:
            continue

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ]

        try:
            reply = chat_once(messages)
        except Exception as e:
            print(f"❌ Error: {e}\n")
            continue

        print("\n--- Draft ---\n")
        print(reply)
        print("\n-------------\n")

        try:
            path = save_as_txt(prompt=user, content=reply, subdir="paralegal")
            print(f"📄 Saved to: {path}\n")
        except Exception as e:
            print(f"⚠️ Could not save draft: {e}\n")