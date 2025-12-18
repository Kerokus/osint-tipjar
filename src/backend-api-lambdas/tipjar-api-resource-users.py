# website.url/users

import json
import psycopg2
from psycopg2.extras import RealDictCursor

# --- Common Lambda Layer ---
from common.db import get_db_connection
from common.utils import with_cors, parse_body

# --- CORRECTED: Returns a Python list in the body ---
def get_all_users(cur):
    """Fetches all users and returns them as a list of dictionaries."""
    cur.execute("SELECT * FROM users ORDER BY last_name, first_name;")
    users = cur.fetchall()
    # The body is now a Python list, not a JSON string
    return {'statusCode': 200, 'body': users}

# --- CORRECTED: Returns a Python dict in the body ---
def get_user_by_cin(cur, cin):
    """Fetches a single user by CIN and returns them as a dictionary."""
    cur.execute("SELECT * FROM users WHERE cin = %s;", (cin,))
    user = cur.fetchone()
    if user:
        # The body is now a Python dict
        return {"statusCode": 200, "body": user}
    else:
        # The body is now a Python dict
        return {"statusCode": 404, "body": {"message": "User not found"}}

# --- CORRECTED: Returns a Python dict in the body ---
def create_user(cur, conn, event):
    try:
        data = parse_body(event)
        # ... (rest of your data extraction logic) ...
        cin = data['cin']
        last_name = data['last_name']
        first_name = data['first_name']
        unit = data.get('unit')
        service_type = data.get('service_type')
        user_status = data.get('user_status')
        added_by = data.get('added_by')
        
        sql = """
            INSERT INTO users (cin, last_name, first_name, unit, service_type, user_status, added_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING cin;
        """
        cur.execute(sql, (cin, last_name, first_name, unit, service_type, user_status, added_by))
        new_cin = cur.fetchone()['cin']
        conn.commit()
        return {'statusCode': 201, 'body': {"message": f"User {new_cin} created successfully"}}
    except KeyError as e:
        return {'statusCode': 400, 'body': {"message": f"Missing required field in request body: {e}"}}

# --- CORRECTED: Returns a Python dict in the body ---
def update_user(cur, conn, cin, event):
    data = parse_body(event)
    updates, params = [], []
    
    allowed_fields = [
        'last_name', 'first_name', 'unit', 'service_type', 'user_status',
        'is_admin', 'first_login', 'user_comments', 'chatsurfer_display_name', 'pass_hash'
    ]
    for field in allowed_fields:
        if field in data:
            updates.append(f"{field} = %s")
            params.append(data[field])

    if not updates:
        return {'statusCode': 400, 'body': {"message": "No fields to update provided"}}

    sql = f"UPDATE users SET {', '.join(updates)} WHERE cin = %s;"
    params.append(cin)
    cur.execute(sql, tuple(params))

    if cur.rowcount == 0:
        return {'statusCode': 404, 'body': {"message": f"User {cin} not found"}}
    
    conn.commit()
    return {'statusCode': 200, 'body': {"message": f"User {cin} updated successfully"}}

# --- CORRECTED: Returns a Python dict in the body ---
def delete_user(cur, conn, cin):
    cur.execute("DELETE FROM users WHERE cin = %s;", (cin,))
    if cur.rowcount == 0:
        return {'statusCode': 404, 'body': {"message": f"User {cin} not found"}}
    conn.commit()
    return {'statusCode': 200, 'body': {"message": f"User {cin} deleted successfully"}}

def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return with_cors(None)

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        http_method = event.get("httpMethod")
        path_params = event.get("pathParameters") or {}
        cin = path_params.get("id")

        response = None
        if http_method == "GET":
            response = get_user_by_cin(cur, cin) if cin else get_all_users(cur)
        elif http_method == "POST":
            response = create_user(cur, conn, event)
        elif http_method == "PUT":
            response = {"statusCode": 400, "body": {"message": "Missing user 'cin' for update"}} if not cin else update_user(cur, conn, cin, event)
        elif http_method == "DELETE":
            response = {"statusCode": 400, "body": {"message": "Missing user 'cin' for delete"}} if not cin else delete_user(cur, conn, cin)
        else:
            response = {"statusCode": 405, "body": {"message": "Method Not Allowed"}}
        
        # <<< --- ADD THIS BLOCK TO CENTRALIZE JSON SERIALIZATION --- >>>
        if response and 'body' in response:
            response['body'] = json.dumps(response['body'], default=str)
        # <<< --- END OF NEW BLOCK --- >>>
        
        return with_cors(response)

    except psycopg2.Error as e:
        if conn: conn.rollback()
        # Ensure error messages are also properly formatted
        error_response = {"statusCode": 500, "body": json.dumps({"message": f"Database error: {str(e)}"}) }
        return with_cors(error_response)
    except Exception as e:
        # Ensure error messages are also properly formatted
        error_response = {"statusCode": 500, "body": json.dumps({"message": f"Server error: {str(e)}"}) }
        return with_cors(error_response)
    finally:
        if conn:
            conn.close()