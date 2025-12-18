# website.url/requirements

import json
import psycopg2
from psycopg2.extras import execute_values, RealDictCursor

# --- Common Lambda Layer ---
from common.db import get_db_connection
from common.utils import with_cors, parse_body

def _json(status, payload):
    return {"statusCode": status, "body": json.dumps(payload, default=str)}

# ---------------------------------------------------------
# 1. GET: Fetch Requirements (Grouped for Dropdowns)
# ---------------------------------------------------------
def get_requirements(cur, event):
    sql = """
        SELECT 
            category_name,
            category_id as category_code,
            json_agg(requirement_id ORDER BY requirement_id) as requirements
        FROM requirements
        GROUP BY category_name, category_id
        ORDER BY category_name;
    """
    cur.execute(sql)
    rows = cur.fetchall()
    return _json(200, rows)

# ---------------------------------------------------------
# 2. POST Logic: Dispatcher
# ---------------------------------------------------------
def handle_post(cur, conn, event):
    payload = parse_body(event)
    if not payload:
        return _json(400, {"message": "Payload cannot be empty"})
    
    # Ensure payload is a list (single adds sent as list of 1)
    if not isinstance(payload, list):
        payload = [payload]

    # Check query params for mode
    qp = (event or {}).get("queryStringParameters") or {}
    mode = qp.get("mode", "append") # Default to 'append' (safe add)

    if mode == "batch":
        return batch_sync_requirements(cur, conn, payload)
    else:
        return append_requirements(cur, conn, payload)

# --- Option A: Batch Sync (Destructive - For Upload Tool) ---
def batch_sync_requirements(cur, conn, payload):
    # 1. Get current DB state
    cur.execute("SELECT requirement_id FROM requirements")
    current_db_ids = set(row['requirement_id'] for row in cur.fetchall())
    
    # 2. Get incoming state
    payload_map = {item['requirement_id']: item for item in payload}
    incoming_ids = set(payload_map.keys())

    # 3. Calculate Deltas
    ids_to_delete = list(current_db_ids - incoming_ids)
    ids_to_add = list(incoming_ids - current_db_ids)

    # 4. Delete missing
    if ids_to_delete:
        cur.execute("DELETE FROM requirements WHERE requirement_id = ANY(%s)", (ids_to_delete,))

    # 5. Insert new
    if ids_to_add:
        insert_rows = []
        for req_id in ids_to_add:
            item = payload_map[req_id]
            insert_rows.append((
                item['requirement_id'],
                item['category_name'],
                str(item['category_id'])
            ))
        sql = "INSERT INTO requirements (requirement_id, category_name, category_id) VALUES %s"
        execute_values(cur, sql, insert_rows)

    conn.commit()
    return _json(200, {
        "message": "Batch sync complete",
        "added": len(ids_to_add),
        "deleted": len(ids_to_delete),
        "total_active": len(incoming_ids)
    })

# --- Option B: Append Only (Safe - For Manual Add) ---
def append_requirements(cur, conn, payload):
    insert_rows = []
    for item in payload:
        insert_rows.append((
            item['requirement_id'],
            item['category_name'],
            str(item['category_id'])
        ))
    
    # Upsert: Insert new, or update category info if ID exists
    sql = """
        INSERT INTO requirements (requirement_id, category_name, category_id) 
        VALUES %s
        ON CONFLICT (requirement_id) DO UPDATE 
        SET category_name = EXCLUDED.category_name, 
            category_id = EXCLUDED.category_id
    """
    execute_values(cur, sql, insert_rows)
    conn.commit()
    
    return _json(200, {"message": f"Successfully added/updated {len(payload)} requirements"})

# ---------------------------------------------------------
# Main Handler
# ---------------------------------------------------------
def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return with_cors(None)

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        http_method = event.get("httpMethod")
        path_params = event.get("pathParameters") or {}
        req_id = path_params.get("id")

        response = None

        if http_method == "GET":
            response = get_requirements(cur, event)
            
        elif http_method == "POST":
            response = handle_post(cur, conn, event)

        elif http_method == "DELETE":
            if req_id:
                # Delete Single Requirement
                cur.execute("DELETE FROM requirements WHERE requirement_id = %s", (req_id,))
                if cur.rowcount == 0:
                    response = _json(404, {"message": "Requirement not found"})
                else:
                    conn.commit()
                    response = _json(200, {"message": "Deleted"})
            else:
                # === NEW: Clear All Logic ===
                cur.execute("TRUNCATE TABLE requirements;")
                conn.commit()
                response = _json(200, {"message": "All requirements cleared"})

        else:
            response = _json(405, {"message": "Method Not Allowed"})

        # This return statement must be aligned exactly with the if/else block above
        return with_cors(response)

    except psycopg2.Error as e:
        if conn: conn.rollback()
        return with_cors(_json(500, {"message": f"Database error: {str(e)}"}))
    except Exception as e:
        return with_cors(_json(500, {"message": f"Server error: {str(e)}"}))
    finally:
        if conn: conn.close()