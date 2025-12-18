# website.url/reports

import json
import uuid
import psycopg2

# --- Common Lambda Layer ---
from common.db import get_db_connection
from common.utils import with_cors, parse_body

def _json(status, payload):
    """Local JSON response helper to preserve original logic."""
    return {"statusCode": status, "body": json.dumps(payload, default=str)}

def _is_uuid(s: str) -> bool:
    """Validates if a string is a UUID."""
    try:
        uuid.UUID(s)
        return True
    except (ValueError, TypeError):
        return False

_REPORT_COLS = [
    "overall_classification","title","date_of_information","time","created_by","created_on",
    "macom","country","location","mgrs","is_usper","has_uspi","source_platform","source_name",
    "did_what","uid","article_title","article_author","report_body","collector_classification",
    "source_description","additional_comment_text","image_url","modified_by","modified_on", "requirements"
]
_SORTABLE = {"created_on", "date_of_information", "country", "source_platform", "source_name"}

# --- Core Logic Functions (Copied from original file) ---

def get_all_reports(cur, event):
    qp = (event or {}).get("queryStringParameters") or {}
    where, params = [], []

    if qp.get("q"):
        where.append("search_vector @@ plainto_tsquery('english', %s)")
        params.append(qp["q"])
    
    if qp.get("location"):
        where.append("location ILIKE %s")
        params.append(f"%{qp['location']}%")

    filter_fields = ["country", "source_platform", "source_name", "macom", "created_by"]
    for field in filter_fields:
        if qp.get(field):
            like_key = f"{field}_like"
            if str(qp.get(like_key, "false")).lower() == "true":
                where.append(f"{field} ILIKE %s")
                params.append(f"%{qp[field]}%")
            else:
                where.append(f"{field} = %s")
                params.append(qp[field])

    if qp.get("doi_prefix"):
        where.append("date_of_information LIKE %s"); params.append(qp["doi_prefix"] + "%")
    if qp.get("created_from"):
        where.append("created_on >= %s"); params.append(qp["created_from"])
    if qp.get("created_to"):
        where.append("created_on <= %s"); params.append(qp["created_to"])

    # --- NEW: Get the total count ---
    # Build the base query for counting total matching reports
    count_sql = "SELECT COUNT(*) FROM tip_reports"
    if where:
        count_sql += " WHERE " + " AND ".join(where)
    
    # Execute the count query with the same parameters (before adding limit/offset)
    cur.execute(count_sql, tuple(params))
    total_count = cur.fetchone()[0]
    # --- END NEW ---

    sort = qp.get("sort", "created_on") if qp.get("sort") in _SORTABLE else "created_on"
    order = "ASC" if (qp.get("order") or "").lower() == "asc" else "DESC"
    limit = int(qp.get("limit") or 50)
    offset = int(qp.get("offset") or 0)

    # Now, build the query to get the actual data page
    sql = f"SELECT {', '.join(_REPORT_COLS)}, id FROM tip_reports"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += f" ORDER BY {sort} {order} NULLS LAST LIMIT %s OFFSET %s;"
    
    # Add limit and offset to the parameters for this query
    params.extend([limit, offset])

    cur.execute(sql, tuple(params))
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    
    # --- NEW: Return data in a structured object ---
    response_data = {
        "total": total_count,
        "results": [dict(zip(cols, r)) for r in rows]
    }
    return _json(200, response_data)

def get_report_by_id(cur, report_id: str):
    cur.execute("SELECT * FROM tip_reports WHERE id = %s;", (report_id,))
    row = cur.fetchone()
    if not row:
        return _json(404, {"message": f"Report {report_id} not found"})
    cols = [d[0] for d in cur.description]
    return _json(200, dict(zip(cols, row)))

def create_report(cur, conn, event):
    data = parse_body(event)
    if not data.get("created_by") or not data.get("report_body"):
        return _json(400, {"message": "created_by and report_body are required"})

    fields, values, params = ["created_on"], ["NOW()"], []
    for k in _REPORT_COLS:
        if k in ("created_on", "modified_on"): continue
        if k in data:
            fields.append(k)
            values.append("%s")
            params.append(data[k])

    sql = f"INSERT INTO tip_reports ({', '.join(fields)}) VALUES ({', '.join(values)}) RETURNING id;"
    cur.execute(sql, tuple(params))
    new_id = str(cur.fetchone()[0])
    conn.commit()
    return _json(201, {"id": new_id})

def update_report(cur, conn, report_id: str, event):
    data = parse_body(event)
    updates, params = [], []

    for k in _REPORT_COLS:
        if k in ("created_on", "modified_on"): continue
        if k in data:
            updates.append(f"{k} = %s")
            params.append(data[k])

    if not updates:
        return _json(400, {"message": "No fields to update"})

    updates.append("modified_on = NOW()")
    sql = f"UPDATE tip_reports SET {', '.join(updates)} WHERE id = %s;"
    params.append(report_id)

    cur.execute(sql, tuple(params))
    if cur.rowcount == 0:
        return _json(404, {"message": f"Report {report_id} not found"})
    conn.commit()
    return _json(200, {"message": f"Report {report_id} updated"})

def delete_report(cur, conn, report_id: str):
    cur.execute("DELETE FROM tip_reports WHERE id = %s;", (report_id,))
    if cur.rowcount == 0:
        return _json(404, {"message": f"Report {report_id} not found"})
    conn.commit()
    return _json(200, {"message": f"Report {report_id} deleted"})


# --- Lambda Entry Point ---
def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return with_cors(None)

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor() # Using a standard cursor to match original logic

        http_method = event.get("httpMethod")
        path_params = event.get("pathParameters") or {}
        report_id = path_params.get("id")

        if report_id and not _is_uuid(report_id):
            return with_cors(_json(400, {"message": "Report ID must be a valid UUID"}))

        response = None
        if http_method == "GET":
            response = get_report_by_id(cur, report_id) if report_id else get_all_reports(cur, event)
        elif http_method == "POST":
            response = create_report(cur, conn, event)
        elif http_method == "PUT":
            response = _json(400, {"message": "Missing report ID for update"}) if not report_id else update_report(cur, conn, report_id, event)
        elif http_method == "DELETE":
            response = _json(400, {"message": "Missing report ID for delete"}) if not report_id else delete_report(cur, conn, report_id)
        else:
            response = _json(405, {"message": "Method Not Allowed"})
        
        return with_cors(response)

    except psycopg2.Error as e:
        if conn: conn.rollback()
        return with_cors({"statusCode": 500, "body": json.dumps({"message": f"Database error: {str(e)}"})})
    except Exception as e:
        return with_cors({"statusCode": 500, "body": json.dumps({"message": f"Server error: {str(e)}"})})
    finally:
        if conn:
            conn.close()
