import os
import asyncio
from dotenv import load_dotenv
import google.generativeai as genai

async def test_gemini_generation():
    load_dotenv('apps/api/.env')
    api_key = os.getenv("GEMINI_API_KEY")
    # Sử dụng model theo yêu cầu của người dùng
    model_name = "gemini-3.1-flash-lite-preview"
    
    print(f"Using API Key: {api_key[:10]}...")
    print(f"Using Model: {model_name}")
    
    genai.configure(api_key=api_key)
    
    model = genai.GenerativeModel(model_name)
    
    prompt = "Xin chào, bạn là ai? Hãy trả lời ngắn gọn."
    
    try:
        print(f"Testing generation with prompt: '{prompt}'...")
        response = await model.generate_content_async(prompt)
        
        print("-" * 30)
        print(f"Response text:\n{response.text}")
        print("-" * 30)
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_gemini_generation())
