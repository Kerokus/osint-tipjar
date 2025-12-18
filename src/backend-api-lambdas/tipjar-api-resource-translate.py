# website.url/translate

import json
import boto3
from botocore.exceptions import ClientError

# --- Common Lambda Layer ---
from common.utils import with_cors

# --- Service Client ---
# Initialize the client outside the handler for reuse
try:
    translate_client = boto3.client('translate')
except Exception as e:
    # Handle initialization error, e.g., missing credentials
    translate_client = None
    print(f"Error initializing Boto3 client: {e}")

def handle_translation(event):
    """
    Handles GET /translate with text, targetLang, and optional sourceLang.
    """
    if not translate_client:
        return {"statusCode": 500, "body": json.dumps({"message": "Translation service is not available"})}

    qp = (event or {}).get("queryStringParameters") or {}

    # 1. Get required parameters
    text_to_translate = qp.get("text")
    target_language = qp.get("targetLang")

    # 2. Get optional source language (default to 'auto')
    # If the frontend sends "auto" or just omits it, we use "auto".
    source_language = qp.get("sourceLang", "auto")
    if not source_language: # Handle empty string case
        source_language = "auto" 

    # 3. Validate input
    if not text_to_translate or not target_language:
        return {"statusCode": 400, "body": json.dumps({
            "message": "Missing required query string parameters: 'text' and 'targetLang'"
        })}

    # 4. Call AWS Translate
    try:
        response = translate_client.translate_text(
            Text=text_to_translate,
            SourceLanguageCode=source_language,
            TargetLanguageCode=target_language
        )
        
        # 5. Format the successful response
        response_body = {
            "translatedText": response.get("TranslatedText"),
            "sourceLanguage": response.get("SourceLanguageCode"),
            "targetLanguage": response.get("TargetLanguageCode")
        }
        
        return {"statusCode": 200, "body": json.dumps(response_body)}

    except ClientError as e:
        # Handle specific Boto3 errors
        error_code = e.response.get("Error", {}).get("Code")
        error_message = e.response.get("Error", {}).get("Message")
        
        if error_code == "ValidationException":
             return {"statusCode": 400, "body": json.dumps({"message": f"Invalid parameter: {error_message}"})}
        if error_code == "UnsupportedLanguagePairException":
             return {"statusCode": 400, "body": json.dumps({"message": f"Language pair not supported: from '{source_language}' to '{target_language}'"})}
        
        return {"statusCode": 500, "body": json.dumps({"message": f"Translation service error: {error_message}"})}
    except Exception as e:
        # Catch other unexpected errors
        # --- FIX 1 WAS HERE ---
        return {"statusCode": 500, "body": json.dumps({"message": f"Server error: {str(e)}"})}

# --- Lambda Entry Point ---

def lambda_handler(event, context):
    """
    Main entry point for the Lambda function.
    Routes requests based on the HTTP method.
    """
    # Handle CORS preflight OPTIONS request
    if event.get("httpMethod") == "OPTIONS":
        return with_cors(None)

    response = None
    try:
        http_method = event.get("httpMethod")

        if http_method == "GET":
            response = handle_translation(event)
        else:
            response = {"statusCode": 405, "body": json.dumps({"message": "Method Not Allowed"})}
        
        # Wrap the final response with CORS headers
        return with_cors(response)

    except Exception as e:
        response = {"statusCode": 500, "body": json.dumps({"message": f"Unhandled server error: {str(e)}"})}
        return with_cors(response)