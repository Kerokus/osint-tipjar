# website.url/platforms

import json
import psycopg2
from psycopg2.extras import RealDictCursor

# --- Common Lambda Layer ---
from common.db import get_db_connection
from common.utils import with_cors, parse_body

def get_all_platforms(cur):
    cur.execute("SELECT id, platform_name FROM platforms ORDER BY platform_name;")
    rows = cur.fetchall()
    return {"statusCode": 200, "body": json.dumps(rows, default=str)}

def get_platform_by_id(cur, platform_id: int):
    cur.execute("SELECT id, platform_name FROM platforms WHERE id = %s;", (platform_id,))
    row = cur.fetchone()
    if not row:
        return {"statusCode": 404, "body": json.dumps({"message": f"Platform with id {platform_id} not found"})}
    return {"statusCode": 200, "body": json.dumps(row, default=str)}

def create_platform(cur, conn, event):
    try:
        data = parse_body(event)
        platform_name = data["platform_name"]

        sql = "INSERT INTO platforms (platform_name) VALUES (%s) RETURNING id;"
        cur.execute(sql, (platform_name,))
        new_id = cur.fetchone()['id']
        conn.commit()
        return {"statusCode": 201, "body": json.dumps({"message": "Platform created", "id": new_id})}
    except KeyError as e:
        return {"statusCode": 400, "body": json.dumps({"message": f"Missing required field: {e}"})}

def update_platform(cur, conn, platform_id: int, event):
    data = parse_body(event)
    
    if "platform_name" not in data:
        return {"statusCode": 400, "body": json.dumps({"message": "No fields to update"})}

    sql = "UPDATE platforms SET platform_name = %s WHERE id = %s;"
    cur.execute(sql, (data["platform_name"], platform_id))
    
    if cur.rowcount == 0:
        return {"statusCode": 404, "body": json.dumps({"message": f"Platform with id {platform_id} not found"})}
    
    conn.commit()
    return {"statusCode": 200, "body": json.dumps({"message": f"Platform with id {platform_id} updated"})}

def delete_platform(cur, conn, platform_id: int):
    cur.execute("DELETE FROM platforms WHERE id = %s;", (platform_id,))
    if cur.rowcount == 0:
        return {"statusCode": 404, "body": json.dumps({"message": f"Platform with id {platform_id} not found"})}
    conn.commit()
    return {"statusCode": 200, "body": json.dumps({"message": f"Platform with id {platform_id} deleted"})}


# --- Lambda Entry Point ---

def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return with_cors(None)

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        http_method = event.get("httpMethod")
        path_params = event.get("pathParameters") or {}
        platform_id_str = path_params.get("id")

        platform_id = None
        if platform_id_str:
            try:
                platform_id = int(platform_id_str)
            except ValueError:
                return with_cors({'statusCode': 400, 'body': json.dumps({"message": "Platform ID must be an integer"})})

        response = None
        if http_method == "GET":
            response = get_platform_by_id(cur, platform_id) if platform_id is not None else get_all_platforms(cur)
        elif http_method == "POST":
            response = create_platform(cur, conn, event)
        elif http_method == "PUT":
            if platform_id is None:
                response = {"statusCode": 400, "body": json.dumps({"message": "Missing platform ID for update"})}
            else:
                response = update_platform(cur, conn, platform_id, event)
        elif http_method == "DELETE":
            if platform_id is None:
                response = {"statusCode": 400, "body": json.dumps({"message": "Missing platform ID for delete"})}
            else:
                response = delete_platform(cur, conn, platform_id)
        else:
            response = {"statusCode": 405, "body": json.dumps({"message": "Method Not Allowed"})}
        
        return with_cors(response)

    except psycopg2.Error as e:
        return with_cors({"statusCode": 500, "body": json.dumps({"message": f"Database error: {str(e)}"})})
    except Exception as e:
        return with_cors({"statusCode": 500, "body": json.dumps({"message": f"Server error: {str(e)}"})})
    finally:
        if conn:
            conn.close()