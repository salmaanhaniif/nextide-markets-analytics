import google.generativeai as genai
import os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

# for model in genai.list_models():
#     print(model.name)

print("Testing Gemini API...")

for model in genai.list_models():
    if 'generateContent' in model.supported_generation_methods:
        print(model.name)

from groq import Groq
import os

client = Groq(api_key=os.environ["GROQ_API_KEY"])

models = client.models.list()

print("\n\nTesting Groq API...")

for model in models.data:
    print(model.id)