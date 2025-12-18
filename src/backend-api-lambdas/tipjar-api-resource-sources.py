# website.url/sources

import json
import psycopg2
from psycopg2.extras import RealDictCursor

# --- Common Lambda Layer ---
from common.db import get_db_connection
from common.utils import with_cors, parse_body

def get_sources(cur, event):
    """Handles GET /sources with optional searching, filtering, and pagination."""
    qp = (event or {}).get("queryStringParameters") or {}
    
    try:
        limit = int(qp.get("limit", 50))
        offset = int(qp.get("offset", 0))
    except (ValueError, TypeError):
        limit = 50
        offset = 0

    base_sql = "FROM sources s" 
    conditions, params = [], []
    
    filterable_keys = ["source_name", "source_description", "source_platform", "added_by"]
    for key in filterable_keys:
        if key in qp:
            value = qp[key]
            if str(qp.get(f"{key}_like", "false")).lower() == "true":
                conditions.append(f"s.{key} ILIKE %s")
                params.append(f"%{value}%")
            elif key == "source_name":
                conditions.append(f"s.{key} ILIKE %s")
                params.append(value)
            else:
                conditions.append(f"s.{key} = %s")
                params.append(value)

    where_clause = ""
    if conditions:
        where_clause = " WHERE " + " AND ".join(conditions)
    count_sql = f"SELECT COUNT(*) AS total {base_sql} {where_clause}"
    cur.execute(count_sql, tuple(params))
    total_count = cur.fetchone()['total']
    data_sql = f"SELECT * {base_sql} {where_clause} ORDER BY s.source_name LIMIT %s OFFSET %s;"
    
    paginated_params = params + [limit, offset]
    
    cur.execute(data_sql, tuple(paginated_params))
    rows = cur.fetchall()
    
    response_body = {
        "total": total_count,
        "data": rows
    }
    
    return {"statusCode": 200, "body": json.dumps(response_body, default=str)}

def get_source_by_id(cur, source_id: int):
    """Fetches a single source by its ID."""
    cur.execute("SELECT * FROM sources WHERE id = %s;", (source_id,))
    row = cur.fetchone()
    if not row:
        return {"statusCode": 404, "body": json.dumps({"message": f"Source with id {source_id} not found"})}
    return {"statusCode": 200, "body": json.dumps(row, default=str)}

def create_source(cur, conn, event):
    try:
        data = parse_body(event)
        # Add the 'added_on' column and use NOW() for the value
        sql = """
            INSERT INTO sources (source_platform, source_name, source_description, added_by, added_on)
            VALUES (%s, %s, %s, %s, NOW()) RETURNING id;
        """
        cur.execute(sql, (data["source_platform"], data["source_name"], data.get("source_description"), data.get("added_by")))
        new_id = cur.fetchone()['id']
        conn.commit()
        return {"statusCode": 201, "body": json.dumps({"message": "Source created", "id": new_id})}
    except KeyError as e:
        return {"statusCode": 400, "body": json.dumps({"message": f"Missing required field: {e}"})}

def update_source(cur, conn, source_id: int, event):
    data = parse_body(event)
    updates, params = [], []

    allowed_fields = ["source_platform", "source_name", "source_description", "modified_by"]
    for field in allowed_fields:
        if field in data:
            updates.append(f"{field} = %s")
            params.append(data[field])

    if not updates:
        return {"statusCode": 400, "body": json.dumps({"message": "No fields to update"})}

    sql = f"UPDATE sources SET {', '.join(updates)}, modified_on = NOW() WHERE id = %s;"
    params.append(source_id)
    cur.execute(sql, tuple(params))
    
    if cur.rowcount == 0:
        return {"statusCode": 404, "body": json.dumps({"message": f"Source with id {source_id} not found"})}
    
    conn.commit()
    return {"statusCode": 200, "body": json.dumps({"message": f"Source with id {source_id} updated"})}

def delete_source(cur, conn, source_id: int):
    cur.execute("DELETE FROM sources WHERE id = %s;", (source_id,))
    if cur.rowcount == 0:
        return {"statusCode": 404, "body": json.dumps({"message": f"Source with id {source_id} not found"})}
    conn.commit()
    return {"statusCode": 200, "body": json.dumps({"message": f"Source with id {source_id} deleted"})}

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
        source_id_str = path_params.get("id")

        source_id = None
        if source_id_str:
            try:
                source_id = int(source_id_str)
            except ValueError:
                return with_cors({'statusCode': 400, 'body': json.dumps({"message": "Source ID must be an integer"})})

        response = None
        if http_method == "GET":
            response = get_source_by_id(cur, source_id) if source_id is not None else get_sources(cur, event)
        elif http_method == "POST":
            response = create_source(cur, conn, event)
        elif http_method == "PUT":
            response = {"statusCode": 400, "body": json.dumps({"message": "Missing source ID for update"})} if source_id is None else update_source(cur, conn, source_id, event)
        elif http_method == "DELETE":
            response = {"statusCode": 400, "body": json.dumps({"message": "Missing source ID for delete"})} if source_id is None else delete_source(cur, conn, source_id)
        else:
            response = {"statusCode": 405, "body": json.dumps({"message": "Method Not Allowed"})}
        
        return with_cors(response)

    except psycopg2.Error as e:
        if conn: conn.rollback()
        return with_cors({"statusCode": 500, "body": json.dumps({"message": f"Database error: {str(e)}"})})
    except Exception as e:
        return with_cors({"statusCode": 500, "body": json.dumps({"message": f"Server error: {str(e)}"})})
    finally:
        if conn:
            conn.close()