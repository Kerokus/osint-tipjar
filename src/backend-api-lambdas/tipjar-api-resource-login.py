# website.url/login

# /login/app.py

import os
import json
import base64
import time
import bcrypt
import jwt
import psycopg2
from psycopg2.extras import RealDictCursor

# --- Imports from your Lambda Layer ---
from common.db import get_db_connection
from common.utils import with_cors, parse_body

# --- Environment Variables ---
JWT_SECRET_B64 = os.environ.get("JWT_SECRET")
JWT_SECRET = base64.urlsafe_b64decode(JWT_SECRET_B64) if JWT_SECRET_B64 else None

def _handle_login_logic(cur, conn, event):
    """
    Core logic for handling user login, adapted from your original file.
    """
    try:
        data = parse_body(event)
        cin = (data.get('cin') or '').strip()
        pin = (data.get('pin') or '').strip()

        if not cin or not pin:
            return {'statusCode': 400, 'body': json.dumps({'message': 'cin and pin required'})}
        
        cur.execute("SELECT cin, pass_hash, is_admin, first_login, chatsurfer_display_name FROM users WHERE cin = %s;", (cin,))
        user = cur.fetchone()

        if not user:
            return {'statusCode': 404, 'body': json.dumps({'message': 'User not found'})}

        stored_hash = (user.get('pass_hash') or '').replace('\\$', '$')
        if not stored_hash:
            return {'statusCode': 400, 'body': json.dumps({'message': 'No PIN set for this user'})}

        if not bcrypt.checkpw(pin.encode(), stored_hash.encode()):
            return {'statusCode': 401, 'body': json.dumps({'message': 'Invalid credentials'})}

        # Update last_login timestamp (best effort)
        try:
            cur.execute("UPDATE users SET last_login = NOW() WHERE cin = %s;", (cin,))
            conn.commit()
        except Exception:
            conn.rollback() # Rollback on failure but don't block login

        if not JWT_SECRET:
            return {'statusCode': 500, 'body': json.dumps({'message': 'JWT secret not configured on server'})}

        now = int(time.time())
        claims = {
            'sub': user['cin'],
            'cin': user['cin'],
            'is_admin': bool(user.get('is_admin')),
            'iat': now,
            'exp': now + 60*60*8,  # 8-hour token validity
            'scope': 'tipjar.user'
        }
        token = jwt.encode(claims, JWT_SECRET, algorithm='HS256')
        
        # Prepare successful response body
        response_body = {
            'token': token,
            'cin': user['cin'],
            'is_admin': bool(user.get('is_admin')),
            'first_login': bool(user.get('first_login')),
            'display_name': user.get('chatsurfer_display_name')
        }
        
        return {'statusCode': 200, 'body': json.dumps(response_body, default=str)}

    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'message': f'An unexpected login error occurred: {str(e)}'})}

def lambda_handler(event, context):
    """
    Main entry point for the Lambda function.
    """
    # Handle CORS preflight requests
    if event.get("httpMethod") == "OPTIONS":
        return with_cors(None)

    # The /login endpoint should only accept POST requests
    if event.get("httpMethod") != "POST":
        return with_cors({'statusCode': 405, 'body': json.dumps({'message': 'Method Not Allowed'})})

    conn = None
    try:
        conn = get_db_connection()
        # Using RealDictCursor to get column names automatically
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        response = _handle_login_logic(cur, conn, event)
        return with_cors(response)

    except psycopg2.Error as e:
        return with_cors({"statusCode": 500, "body": json.dumps({"message": f"Database connection error: {str(e)}"})})
    except Exception as e:
        return with_cors({"statusCode": 500, "body": json.dumps({"message": f"A server error occurred: {str(e)}"})})
    finally:
        if conn:
            conn.close()