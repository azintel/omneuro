import sys
from modes.paralegal import paralegal_loop

BANNER = "🧠 Omneuro — Multi-Mode Assistant (type 'exit' to quit)\n"

MODES = {
    "1": ("Paralegal Mode", paralegal_loop),
    # Add more modes here: "2": ("Business Mode", business_loop), ...
}

def main():
    print(BANNER)
    while True:
        print("Select a mode:")
        for k, (name, _) in MODES.items():
            print(f"  {k}. {name}")
        choice = input("\nMode > ").strip().lower()

        if choice in ("exit", "quit"):
            print("👋 Bye.")
            sys.exit(0)

        if choice in MODES:
            name, fn = MODES[choice]
            print(f"\n🔀 Switching to {name}...\n")
            fn()
            print("\n↩️  Returning to Omneuro mode menu.\n")
        else:
            print("❓ Invalid choice. Try again.\n")

if __name__ == "__main__":
    main()