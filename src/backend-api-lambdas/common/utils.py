import json

"""
Set your CORS info here. You can keep the 'Allow-Origin' set as '*'
Unless you're trying to return a cookie by using the Secrets library.
If that's the case you'll need to directly specify the URL of the page.
"""
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Api-Key,X-Amz-Date,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}

def with_cors(response):
    """
    Ensures a given response dict includes standard CORS headers and is a complete
    API Gateway proxy response. It safely handles existing headers.
    """
    if response is None:
        # Handles cases where a function returns nothing on success
        return {"statusCode": 204, "headers": CORS_HEADERS, "body": ""}

    # Safely merge CORS headers with any existing headers
    headers = response.get("headers", {}).copy()
    headers.update(CORS_HEADERS)
    response["headers"] = headers

    # Provide defaults for a complete response
    if "statusCode" not in response:
        response["statusCode"] = 200
    if "body" not in response:
        response["body"] = ""

    return response

def parse_body(event):
    """
    Safely parses the JSON body from an API Gateway event, returning an
    empty dictionary if the body is missing or empty.
    """
    return json.loads(event.get("body") or "{}")