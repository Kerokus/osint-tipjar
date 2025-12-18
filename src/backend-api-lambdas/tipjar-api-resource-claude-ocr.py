# website.url/ocr

import boto3
import json
import os

# --- Import from common Lambda Layer ---
from common.utils import with_cors, parse_body

# --- Client Config ---
REGION = os.environ.get("REGION", "us-gov-west-1")
MODEL_ID = os.environ.get("MODEL_ID", "anthropic.claude-3-5-sonnet-20240620-v1:0")

# --- System Policy ---
# Strictly formatted to meet the specific extraction guidelines
SYSTEM_POLICY = """You are a strictly literal Optical Character Recognition (OCR) engine.
Your goal is to extract text from the provided image.

Follow these rules exactly:
1. Extract any/all text exactly as-is, preserving the original language.
2. Do NOT translate anything.
3. Do NOT describe the image or provide explanations (no "Here is the text" preambles).
4. Do NOT correct typos or grammatical errors.
5. If there is no text to extract, return exactly: "Unable to extract any text."
"""

# --- Initialize Boto3 Client ---
bedrock_client = boto3.client("bedrock-runtime", region_name=REGION)


def handle_bedrock_call(event):
    """
    Handles the image processing logic.
    Expects a JSON body with keys: "image" (base64 string) and optional "media_type".
    """
    body = parse_body(event)
    
    # 1. Extract Image Data
    # The frontend should send the image as a Base64 string.
    image_data = body.get("image")
    # Default to jpeg if not specified, usually safe for Claude
    media_type = body.get("media_type", "image/jpeg") 
    
    # Configuration params (optional overrides)
    temperature = float(body.get("temperature", 0)) # Set to 0 for deterministic extraction
    top_p = float(body.get("top_p", 0.5))
    max_tokens = int(body.get("max_tokens", 2000))

    # 2. Validation
    if not image_data:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Request body must contain 'image' (base64 string)."})
        }

    # 3. Construct the Vision Payload for Claude
    # We strip the header if the frontend sent "data:image/jpeg;base64,..."
    if "," in image_data:
        image_data = image_data.split(",")[1]

    user_message = {
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": image_data
                }
            },
            {
                "type": "text",
                "text": "Extract the text from this image."
            }
        ]
    }

    # 4. Construct the Bedrock request body
    bedrock_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "system": SYSTEM_POLICY,
        "messages": [user_message],
        "max_tokens": max_tokens,
        "temperature": temperature, # 0 is best for extraction tasks
        "top_p": top_p,
    }

    # 5. Invoke the model
    resp = bedrock_client.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(bedrock_body).encode("utf-8"),
    )
    
    # 6. Parse the model's response
    payload = json.loads(resp["body"].read().decode("utf-8"))
    
    # Extract text content
    parts = [p.get("text", "") for p in payload.get("content", []) if p.get("type") == "text"]
    response_text = "\n".join(parts).strip()
    
    # Extract token usage
    usage = payload.get("usage", {})
    input_tokens = usage.get("input_tokens", 0)
    output_tokens = usage.get("output_tokens", 0)

    # 7. Create the final API response body
    return_body = {
        "extracted_text": response_text,
        "usage": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens
        }
    }

    # 8. Return the successful response
    return {
        "statusCode": 200,
        "body": json.dumps(return_body)
    }


def lambda_handler(event, context):
    """
    Main entry point for the Lambda function.
    """
    
    # 1. Handle CORS preflight OPTIONS request
    if event.get("httpMethod") == "OPTIONS":
        return with_cors(None)

    response = None
    try:
        http_method = event.get("httpMethod")

        # 2. Route the request
        if http_method == "POST":
            response = handle_bedrock_call(event)
        else:
            response = {
                "statusCode": 405, 
                "body": json.dumps({"message": "Method Not Allowed"})
            }
        
        # 3. Wrap final response with CORS headers
        return with_cors(response)

    except Exception as e:
        print(f"Unhandled server error: {e}")
        response = {
            "statusCode": 500, 
            "body": json.dumps({"message": f"Unhandled server error: {str(e)}"})
        }
        return with_cors(response)