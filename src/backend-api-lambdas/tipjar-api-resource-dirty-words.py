# website.url/dirty_words

import json
import psycopg2
from psycopg2.extras import RealDictCursor

# --- Common Lambda Layer ---
from common.db import get_db_connection
from common.utils import with_cors, parse_body

def get_all_dirty_words(cur):
    cur.execute("SELECT id, dirty_word, word_classification FROM dirty_words ORDER BY dirty_word;")
    rows = cur.fetchall()
    return {"statusCode": 200, "body": json.dumps(rows, default=str)}

def get_dirty_word_by_id(cur, word_id: int):
    cur.execute("SELECT id, dirty_word, word_classification FROM dirty_words WHERE id = %s;", (word_id,))
    row = cur.fetchone()
    if not row:
        return {"statusCode": 404, "body": json.dumps({"message": f"Word with id {word_id} not found"})}
    return {"statusCode": 200, "body": json.dumps(row, default=str)}

def create_dirty_word(cur, conn, event):
    try:
        data = parse_body(event)
        dirty_word = data["dirty_word"]
        word_classification = data.get("word_classification")

        sql = "INSERT INTO dirty_words (dirty_word, word_classification) VALUES (%s, %s) RETURNING id;"
        cur.execute(sql, (dirty_word, word_classification))
        new_id = cur.fetchone()['id']
        conn.commit()
        return {"statusCode": 201, "body": json.dumps({"message": f"Dirty word created", "id": new_id})}
    except KeyError as e:
        return {"statusCode": 400, "body": json.dumps({"message": f"Missing required field: {e}"})}

def update_dirty_word(cur, conn, word_id: int, event):
    data = parse_body(event)
    updates, params = [], []

    if "dirty_word" in data:
        updates.append("dirty_word = %s"); params.append(data["dirty_word"])
    if "word_classification" in data:
        updates.append("word_classification = %s"); params.append(data["word_classification"])

    if not updates:
        return {"statusCode": 400, "body": json.dumps({"message": "No fields to update"})}

    sql = f"UPDATE dirty_words SET {', '.join(updates)} WHERE id = %s;"
    params.append(word_id)
    cur.execute(sql, tuple(params))
    
    if cur.rowcount == 0:
        return {"statusCode": 404, "body": json.dumps({"message": f"Word with id {word_id} not found"})}
    
    conn.commit()
    return {"statusCode": 200, "body": json.dumps({"message": f"Word with id {word_id} updated"})}

def delete_dirty_word(cur, conn, word_id: int):
    cur.execute("DELETE FROM dirty_words WHERE id = %s;", (word_id,))
    if cur.rowcount == 0:
        return {"statusCode": 404, "body": json.dumps({"message": f"Word with id {word_id} not found"})}
    conn.commit()
    return {"statusCode": 200, "body": json.dumps({"message": f"Word with id {word_id} deleted"})}


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
        word_id_str = path_params.get("id")

        word_id = None
        if word_id_str:
            try:
                word_id = int(word_id_str)
            except ValueError:
                return with_cors({'statusCode': 400, 'body': json.dumps({"message": "Word ID must be an integer"})})

        response = None
        if http_method == "GET":
            response = get_dirty_word_by_id(cur, word_id) if word_id is not None else get_all_dirty_words(cur)
        elif http_method == "POST":
            response = create_dirty_word(cur, conn, event)
        elif http_method == "PUT":
            response = {"statusCode": 400, "body": json.dumps({"message": "Missing word ID for update"})} if word_id is None else update_dirty_word(cur, conn, word_id, event)
        elif http_method == "DELETE":
            response = {"statusCode": 400, "body": json.dumps({"message": "Missing word ID for delete"})} if word_id is None else delete_dirty_word(cur, conn, word_id)
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